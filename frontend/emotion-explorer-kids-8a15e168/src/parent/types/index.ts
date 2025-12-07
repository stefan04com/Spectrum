export interface Child {
  id: string;
  name: string;
  age: number;
  avatar: string;
  lastActivity: string;
  disability?: string;
  profile?: ChildProfile;
  hasAvatar?: boolean;
}

export interface MoodEntry {
  date: string;
  mood: 'happy' | 'calm' | 'anxious' | 'sad' | 'angry';
  score: number;
  activities: number;
}

export interface ActivitySummary {
  id: string;
  name: string;
  duration: number;
  completedAt: string;
  mood: 'happy' | 'calm' | 'anxious' | 'sad' | 'angry';
}

export interface DailyReport {
  date: string;
  overallMood: number;
  activitiesCompleted: number;
  timeSpent: number;
  moodBreakdown: {
    happy: number;
    calm: number;
    anxious: number;
    sad: number;
    angry: number;
  };
}

export type DateRange = 'today' | 'week' | 'month' | 'custom';

export interface AvatarTraits {
  gender: string;
  hair: string;
  skin: string;
  glasses: boolean;
}

export interface ChildProfile {
  name: string;
  age: number;
  notes?: string;
  guidance?: string;
  traits: AvatarTraits;
}

export interface TaskEmotionStats {
  childId: string;
  totalLogs: number;
  emotionCounts: Record<string, number>;
  daysWindow?: number | null;
}

export interface TaskStressRecord {
  id: number;
  taskName: string;
  stressLevel: number;
  emotion?: string;
  loggedAt?: string | null;
}

export interface ChildAlertTask {
  taskName: string;
  emotion?: string;
  stressLevel?: number;
  loggedAt?: string | null;
}

export interface ChildAlertDocument {
  source?: string;
  pages?: number[];
  topics?: string[];
  supportContext?: string;
}

export interface ChildAlert {
  id: number;
  childId: string;
  reason: string;
  message: string;
  acknowledged: boolean;
  createdAt: string;
  updatedAt?: string;
  payload?: {
    tasks?: ChildAlertTask[];
    documents?: ChildAlertDocument[];
  };
}
