export interface Task {
  id: string;
  childId: string;
  title: string;
  description?: string;
  scheduledTime: string;
  completed: boolean;
  emotionalFeedback?: EmotionalFeedback;
  createdAt: string;
  date: string; // YYYY-MM-DD format
}

export interface EmotionalFeedback {
  emotion: 'very_happy' | 'happy' | 'neutral' | 'sad' | 'very_stressed';
  stressLevel: number; // 1-5
  submittedAt: string;
}

export interface TaskNotification {
  id: string;
  taskId: string;
  childId: string;
  childName: string;
  taskTitle: string;
  feedback: EmotionalFeedback;
  read: boolean;
  createdAt: string;
}
