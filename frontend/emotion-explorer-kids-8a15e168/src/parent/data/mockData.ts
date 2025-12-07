import { Child, MoodEntry, ActivitySummary, DailyReport } from '@parent/types';

// Generate recent dates dynamically
const getRecentDate = (hoursAgo: number) => {
  const date = new Date();
  date.setHours(date.getHours() - hoursAgo);
  return date.toISOString();
};

export const mockChildren: Child[] = [
  {
    id: '1',
    name: 'Alexandru',
    age: 8,
    avatar: '👦',
    lastActivity: getRecentDate(2),
  },
  {
    id: '2',
    name: 'Maria',
    age: 6,
    avatar: '👧',
    lastActivity: getRecentDate(5),
  },
  {
    id: '3',
    name: 'Andrei',
    age: 10,
    avatar: '🧒',
    lastActivity: getRecentDate(24),
  },
];

export const mockMoodData: MoodEntry[] = [
  { date: '2024-01-09', mood: 'happy', score: 85, activities: 5 },
  { date: '2024-01-10', mood: 'calm', score: 70, activities: 4 },
  { date: '2024-01-11', mood: 'anxious', score: 45, activities: 3 },
  { date: '2024-01-12', mood: 'happy', score: 80, activities: 6 },
  { date: '2024-01-13', mood: 'calm', score: 75, activities: 4 },
  { date: '2024-01-14', mood: 'sad', score: 40, activities: 2 },
  { date: '2024-01-15', mood: 'happy', score: 90, activities: 7 },
];

export const mockActivities: ActivitySummary[] = [
  { id: '1', name: 'Color Puzzle', duration: 15, completedAt: '2024-01-15T09:30:00', mood: 'happy' },
  { id: '2', name: 'Breathing Exercise', duration: 5, completedAt: '2024-01-15T10:00:00', mood: 'calm' },
  { id: '3', name: 'Memory Game', duration: 20, completedAt: '2024-01-15T11:30:00', mood: 'happy' },
  { id: '4', name: 'Interactive Story', duration: 25, completedAt: '2024-01-15T14:00:00', mood: 'calm' },
  { id: '5', name: 'Emotion Recognition', duration: 10, completedAt: '2024-01-15T15:30:00', mood: 'happy' },
];

export const mockDailyReport: DailyReport = {
  date: '2024-01-15',
  overallMood: 78,
  activitiesCompleted: 7,
  timeSpent: 95,
  moodBreakdown: {
    happy: 45,
    calm: 30,
    anxious: 10,
    sad: 10,
    angry: 5,
  },
};

export const moodColors = {
  happy: 'hsl(142, 76%, 36%)',
  calm: 'hsl(199, 89%, 48%)',
  anxious: 'hsl(38, 92%, 50%)',
  sad: 'hsl(215, 16%, 47%)',
  angry: 'hsl(0, 84%, 60%)',
};

export const moodEmojis = {
  happy: '😊',
  calm: '😌',
  anxious: '😰',
  sad: '😢',
  angry: '😠',
};

export const moodLabels = {
  happy: 'Happy',
  calm: 'Calm',
  anxious: 'Anxious',
  sad: 'Sad',
  angry: 'Angry',
};
