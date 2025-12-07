import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useTaskStorage } from '@/hooks/useTaskStorage';
import { EmotionalFeedback } from '@/types/task';
import { ArrowLeft, Clock, CheckCircle2, Sparkles } from 'lucide-react';

// Demo child ID - in production, this would come from authentication
const DEMO_CHILD_ID = '1';
const DEMO_CHILD_NAME = 'Alex';

const Tasks = () => {
  const navigate = useNavigate();
  const { tasks, submitFeedback, loading } = useTaskStorage(DEMO_CHILD_ID);
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [selectedEmotion, setSelectedEmotion] = useState<EmotionalFeedback['emotion'] | null>(null);
  const [stressLevel, setStressLevel] = useState<number>(3);

  const today = new Date().toISOString().split('T')[0];
  const todaysTasks = tasks.filter(t => t.date === today);
  const pendingTasks = todaysTasks.filter(t => !t.completed);
  const completedTasks = todaysTasks.filter(t => t.completed);
  const sortedPendingTasks = [...pendingTasks].sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));

  const emotions: { value: EmotionalFeedback['emotion']; emoji: string; label: string }[] = [
    { value: 'very_happy', emoji: '😄', label: 'Very Happy' },
    { value: 'happy', emoji: '🙂', label: 'Happy' },
    { value: 'neutral', emoji: '😐', label: 'Okay' },
    { value: 'sad', emoji: '😢', label: 'Sad' },
    { value: 'very_stressed', emoji: '😰', label: 'Stressed' },
  ];

  const getStressButtonClass = (level: number) => {
    if (stressLevel === level) {
      if (level <= 2) return 'bg-green-500 text-white';
      if (level === 3) return 'bg-yellow-500 text-white';
      return 'bg-red-500 text-white';
    }
    return 'bg-muted hover:bg-muted/80';
  };

  const handleCompleteTask = async () => {
    if (!selectedTask || !selectedEmotion) return;

    const feedback: EmotionalFeedback = {
      emotion: selectedEmotion,
      stressLevel,
      submittedAt: new Date().toISOString(),
    };

    try {
      await submitFeedback(selectedTask, feedback, DEMO_CHILD_NAME);
    } catch (error) {
      console.error('Task feedback submission failed:', error);
    } finally {
      setSelectedTask(null);
      setSelectedEmotion(null);
      setStressLevel(3);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            onClick={() => navigate('/child')}
            variant="outline"
            size="icon"
            className="rounded-full"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
              📋 My Tasks
            </h1>
            <p className="text-muted-foreground">
              {pendingTasks.length} tasks to complete today
            </p>
          </div>
        </div>

        {/* Feedback Modal */}
        {selectedTask && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md animate-pop">
              <CardContent className="p-6 space-y-6">
                <div className="text-center">
                  <Sparkles className="w-12 h-12 mx-auto text-yellow-500 mb-3" />
                  <h2 className="text-xl font-bold">Great job!</h2>
                  <p className="text-muted-foreground mt-1">
                    How are you feeling after this task?
                  </p>
                </div>

                {/* Emotion Selection */}
                <div className="grid grid-cols-5 gap-2">
                  {emotions.map((emotion) => (
                    <button
                      key={emotion.value}
                      onClick={() => setSelectedEmotion(emotion.value)}
                      className={`flex flex-col items-center p-3 rounded-xl transition-all ${
                        selectedEmotion === emotion.value
                          ? 'bg-primary/20 ring-2 ring-primary scale-105'
                          : 'bg-muted hover:bg-muted/80'
                      }`}
                    >
                      <span className="text-3xl">{emotion.emoji}</span>
                      <span className="text-xs mt-1 text-muted-foreground">
                        {emotion.label}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Stress Level */}
                <div className="space-y-3">
                  <label className="text-sm font-medium">
                    Stress Level: {stressLevel}/5
                  </label>
                  <div className="flex justify-between gap-2">
                    {[1, 2, 3, 4, 5].map((level) => (
                      <button
                        key={level}
                        onClick={() => setStressLevel(level)}
                        className={`flex-1 py-3 rounded-lg font-medium transition-all ${getStressButtonClass(level)}`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Relaxed</span>
                    <span>Very Stressed</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setSelectedTask(null);
                      setSelectedEmotion(null);
                      setStressLevel(3);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1"
                    disabled={!selectedEmotion}
                    onClick={() => {
                      void handleCompleteTask();
                    }}
                  >
                    Submit
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Pending Tasks */}
        <div className="space-y-4 mb-8">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            To Do
          </h2>
          {pendingTasks.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Sparkles className="w-12 h-12 mx-auto text-yellow-500 mb-3" />
                <p className="text-lg font-medium">All done for today!</p>
                <p className="text-muted-foreground">
                  Great job completing all your tasks!
                </p>
              </CardContent>
            </Card>
          ) : (
            sortedPendingTasks.map((task) => (
                <Card
                  key={task.id}
                  className="cursor-pointer transition-all hover:shadow-md hover:scale-[1.02]"
                  onClick={() => setSelectedTask(task.id)}
                >
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Clock className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-lg">{task.title}</p>
                      <p className="text-muted-foreground">{task.scheduledTime}</p>
                    </div>
                    <Button size="sm">
                      Complete
                    </Button>
                  </CardContent>
                </Card>
              ))
          )}
        </div>

        {/* Completed Tasks */}
        {completedTasks.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              Completed
            </h2>
            {completedTasks.map((task) => (
              <Card key={task.id} className="opacity-75">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6 text-green-500" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-lg line-through text-muted-foreground">
                      {task.title}
                    </p>
                    <p className="text-muted-foreground text-sm">
                      {task.scheduledTime}
                    </p>
                  </div>
                  {task.emotionalFeedback && (
                    <div className="text-2xl">
                      {emotions.find(e => e.value === task.emotionalFeedback?.emotion)?.emoji}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Tasks;
