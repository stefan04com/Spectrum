import { Task } from '@/types/task';
import { Clock, CheckCircle2, CalendarDays } from 'lucide-react';
import { cn } from '@parent/lib/utils';
import { format } from 'date-fns';

interface ActivityListProps {
  tasks: Task[];
  isLoading?: boolean;
}

const emotionDetails: Record<string, { emoji: string; label: string }> = {
  very_happy: { emoji: '😄', label: 'Very happy' },
  happy: { emoji: '🙂', label: 'Happy' },
  neutral: { emoji: '😐', label: 'Neutral' },
  sad: { emoji: '😢', label: 'Sad' },
  very_stressed: { emoji: '😰', label: 'Very stressed' },
};

const formatDay = (date: string) => {
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? date : format(parsed, 'dd MMM');
};

export function ActivityList({ tasks, isLoading }: ActivityListProps) {
  const sortedTasks = [...tasks].sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));

  return (
    <div className="glass-card p-6 rounded-xl animate-fade-in">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Current Activities</h3>
          <p className="text-sm text-muted-foreground">Today's schedule synced with the task list</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarDays className="w-4 h-4" />
          {format(new Date(), 'dd MMM yyyy')}
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground py-6">Loading activities…</div>
      ) : sortedTasks.length === 0 ? (
        <div className="text-sm text-muted-foreground py-10 text-center">
          There are no activities for today. Add tasks in the planner to see them here.
        </div>
      ) : (
        <div className="space-y-3">
          {sortedTasks.map((task, index) => {
            const feedback = task.emotionalFeedback;
            const emotionMeta = feedback ? emotionDetails[feedback.emotion] : null;
            return (
              <div
                key={task.id}
                className={cn(
                  "flex items-start gap-4 p-4 rounded-lg border",
                  "bg-muted/30 hover:bg-muted/50 transition-colors duration-200",
                  "animate-slide-up"
                )}
                style={{ animationDelay: `${index * 40}ms` }}
              >
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center",
                  task.completed ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground'
                )}>
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-medium text-foreground">{task.title}</h4>
                    <span className={cn(
                      'text-xs font-medium px-2 py-0.5 rounded-full',
                      task.completed ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary'
                    )}>
                      {task.completed ? 'Completed' : 'Scheduled'}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {task.scheduledTime}
                    </span>
                    <span>•</span>
                    <span>{formatDay(task.date)}</span>
                    {feedback && (
                      <>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          {emotionMeta?.emoji}
                          <span>{emotionMeta?.label}</span>
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  {feedback ? (
                    <div className="text-xs text-muted-foreground">
                      <div className="font-medium text-foreground">Stress: {feedback.stressLevel}/5</div>
                      <div>{emotionMeta?.label}</div>
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground">No feedback yet</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
