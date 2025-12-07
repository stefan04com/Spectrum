import { useMemo } from 'react';
import { Child } from '@parent/types';
import { StressProgressChart } from './StressProgressChart';
import { MoodBreakdownChart } from './MoodBreakdownChart';
import { StatsCard } from './StatsCard';
import { ActivityList } from './ActivityList';
import { TaskManager } from './TaskManager';
import { TaskTemplateCard } from './TaskTemplateCard';
import { ChildProfileCard } from './ChildProfileCard';
import { Gamepad2, Activity } from 'lucide-react';
import { ChildAlertBanner } from '@parent/components/ChildAlertBanner';
import { useChildAlerts } from '@parent/hooks/useChildAlerts';
import { useTaskEmotionStats } from '@parent/hooks/useTaskEmotionStats';
import { useTaskStressHistory } from '@parent/hooks/useTaskStressHistory';
import { useTaskStorage } from '@/hooks/useTaskStorage';


interface DashboardProps {
  child: Child;
  onDeleteChild?: (child: Child) => void | Promise<void>;
  deletingChildId?: string | null;
}

const EMOTION_SCORE_WEIGHTS: Record<string, number> = {
  very_happy: 100,
  happy: 90,
  neutral: 70,
  sad: 45,
  very_stressed: 15,
};

export function Dashboard({ child, onDeleteChild, deletingChildId }: DashboardProps) {
  const { activeAlert, isLoading: alertsLoading, acknowledgeAlert } = useChildAlerts(child.id);
  const { stats: emotionStats, isLoading: emotionStatsLoading } = useTaskEmotionStats(child.id, 30);
  const { records: stressHistory, isLoading: stressHistoryLoading } = useTaskStressHistory(child.id, 5);
  const taskStore = useTaskStorage();
  const todayKey = useMemo(() => new Date().toISOString().split('T')[0], []);
  const todaysTasks = useMemo(
    () =>
      taskStore.tasks.filter(
        (task) => task.childId === child.id && task.date === todayKey,
      ),
    [taskStore.tasks, child.id, todayKey]
  );
  const pendingTasks = todaysTasks.filter((task) => !task.completed);

  const completedActivitiesCount = useMemo(
    () => todaysTasks.filter((task) => task.completed).length,
    [todaysTasks]
  );

  const todaysActivitiesSubtitle = useMemo(() => {
    if (taskStore.loading) {
      return "Syncing today's planner";
    }
    if (!todaysTasks.length) {
      return 'No activities scheduled';
    }
    return `${completedActivitiesCount} of ${todaysTasks.length} completed`;
  }, [taskStore.loading, todaysTasks, completedActivitiesCount]);

  const gameScore = useMemo(() => {
    if (!emotionStats || !emotionStats.totalLogs) {
      return null;
    }

    const weightedSum = Object.entries(emotionStats.emotionCounts || {}).reduce((total, [emotion, count]) => {
      const weight = EMOTION_SCORE_WEIGHTS[emotion] ?? 50;
      return total + weight * Number(count);
    }, 0);

    return Math.round(weightedSum / Math.max(1, emotionStats.totalLogs));
  }, [emotionStats]);

  const gameScoreSubtitle = useMemo(() => {
    if (emotionStatsLoading) {
      return 'Updating score...';
    }
    if (!emotionStats || !emotionStats.totalLogs) {
      return 'No game data yet';
    }
    return ""
  }, [emotionStats, emotionStatsLoading]);

  const gameScoreDisplayValue = emotionStatsLoading
    ? '...'
    : gameScore !== null
      ? `${gameScore}%`
      : '--';

  const activitiesDisplayValue = taskStore.loading ? '...' : completedActivitiesCount;


  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full flex items-center justify-center text-4xl bg-gradient-to-br from-primary/20 to-secondary/20">
            {child.avatar}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{child.name}</h1>
            <p className="text-muted-foreground">{child.age} years old</p>
          </div>
        </div>
      </div>

      <ChildProfileCard
        child={child}
        onDelete={onDeleteChild}
        isDeleting={deletingChildId === child.id}
      />

      {(alertsLoading || activeAlert) && (
        <ChildAlertBanner
          alert={activeAlert}
          loading={alertsLoading}
          onDismiss={alertId => acknowledgeAlert(alertId)}
        />
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
        <StatsCard
          title="Game Score"
          value={gameScoreDisplayValue}
          subtitle={gameScoreSubtitle}
          icon={Gamepad2}
          variant="primary"
        />
        <StatsCard
          title="Activities Today"
          value={activitiesDisplayValue}
          subtitle={todaysActivitiesSubtitle}
          icon={Activity}
          variant="success"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <StressProgressChart records={stressHistory} loading={stressHistoryLoading} />
        <MoodBreakdownChart stats={emotionStats} loading={emotionStatsLoading} />
      </div>

      <TaskTemplateCard child={child} taskApi={taskStore} />

      {/* Task Manager */}
      <TaskManager child={child} taskApi={taskStore} tasksOverride={pendingTasks} />

      {/* Activities */}
      <ActivityList tasks={todaysTasks} isLoading={taskStore.loading} />
    </div>
  );
}
