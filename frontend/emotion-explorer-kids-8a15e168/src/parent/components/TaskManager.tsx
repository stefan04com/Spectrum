import { useState } from 'react';
import { Child } from '@parent/types';
import { useTaskStorage, TaskStorageApi } from '@/hooks/useTaskStorage';
import { Task } from '@/types/task';
import { Button } from '@parent/components/ui/button';
import { Input } from '@parent/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@parent/components/ui/card';
import { Plus, Trash2, Clock, Calendar, CheckCircle2 } from 'lucide-react';

interface TaskManagerProps {
  child: Child;
  taskApi?: TaskStorageApi;
  tasksOverride?: Task[];
}

export const TaskManager = ({ child, taskApi, tasksOverride }: TaskManagerProps) => {
  const { tasks, addTask, deleteTask, loading } = taskApi ?? useTaskStorage();
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskTime, setNewTaskTime] = useState('09:00');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const sourceTasks = tasksOverride ?? tasks;
  const childTasks = sourceTasks.filter(
    (t) => t.childId === child.id && t.date === selectedDate,
  );

  const handleAddTask = () => {
    if (!newTaskTitle.trim()) return;

    addTask({
      childId: child.id,
      title: newTaskTitle.trim(),
      scheduledTime: newTaskTime,
      date: selectedDate,
    });

    setNewTaskTitle('');
    setNewTaskTime('09:00');
  };

  const getEmotionEmoji = (emotion?: string) => {
    const emojis: Record<string, string> = {
      'very_happy': '😄',
      'happy': '🙂',
      'neutral': '😐',
      'sad': '😢',
      'very_stressed': '😰',
    };
    return emotion ? emojis[emotion] || '❓' : '';
  };

  const sortedTasks = [...childTasks].sort((a, b) => 
    a.scheduledTime.localeCompare(b.scheduledTime)
  );

  if (loading) {
    return <div className="p-4 text-center text-muted-foreground">Loading tasks...</div>;
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Daily Schedule for {child.name}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Date Selector */}
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-muted-foreground">Date:</label>
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-auto"
          />
        </div>

        {/* Add Task Form */}
        <div className="flex flex-col sm:flex-row gap-3 p-4 bg-muted/50 rounded-lg">
          <Input
            placeholder="Add a new task..."
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
            className="flex-1"
          />
          <div className="flex gap-2">
            <Input
              type="time"
              value={newTaskTime}
              onChange={(e) => setNewTaskTime(e.target.value)}
              className="w-32"
            />
            <Button onClick={handleAddTask} disabled={!newTaskTitle.trim()}>
              <Plus className="w-4 h-4 mr-1" />
              Add
            </Button>
          </div>
        </div>

        {/* Task List */}
        <div className="space-y-2">
          {sortedTasks.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No tasks scheduled for this day. Add tasks above.
            </p>
          ) : (
            sortedTasks.map((task) => (
              <TaskItem 
                key={task.id} 
                task={task} 
                onDelete={deleteTask}
                getEmotionEmoji={getEmotionEmoji}
              />
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};

interface TaskItemProps {
  task: Task;
  onDelete: (id: string) => void;
  getEmotionEmoji: (emotion?: string) => string;
}

const TaskItem = ({ task, onDelete, getEmotionEmoji }: TaskItemProps) => {
  return (
    <div
      className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
        task.completed
          ? 'bg-green-50 border-green-200 text-green-900 dark:bg-green-950/20 dark:border-green-800'
          : 'bg-card border-border hover:bg-muted/50'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
          task.completed ? 'bg-green-100 dark:bg-green-900' : 'bg-muted'
        }`}>
          {task.completed ? (
            <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
          ) : (
            <Clock className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <p className={`font-medium ${task.completed ? 'text-green-800 dark:text-green-300' : ''}`}>
              {task.title}
            </p>
            {task.completed && (
              <span className="text-xs font-semibold uppercase tracking-wide text-green-700 bg-green-100 px-2 py-0.5 rounded-full dark:text-green-200 dark:bg-green-900/40">
                completat
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {task.scheduledTime}
          </p>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        {task.emotionalFeedback && (
          <div className="flex items-center gap-1 px-2 py-1 bg-muted rounded-full">
            <span className="text-lg">{getEmotionEmoji(task.emotionalFeedback.emotion)}</span>
            <span className="text-xs text-muted-foreground">
              Stress: {task.emotionalFeedback.stressLevel}/5
            </span>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(task.id)}
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};
