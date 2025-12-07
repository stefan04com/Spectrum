import { useState, useEffect, useCallback } from 'react';
import { Task, TaskNotification, EmotionalFeedback } from '@/types/task';
import { buildBackendUrl } from '@/lib/api';

// Using localStorage for persistent storage
const TASKS_KEY = 'emotion_app_tasks';
const NOTIFICATIONS_KEY = 'emotion_app_notifications';

export const useTaskStorage = (childId?: string) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notifications, setNotifications] = useState<TaskNotification[]>([]);
  const [loading, setLoading] = useState(true);

  // Load tasks from storage
  const loadTasks = useCallback(() => {
    try {
      const stored = localStorage.getItem(TASKS_KEY);
      const allTasks: Task[] = stored ? JSON.parse(stored) : [];
      if (childId) {
        setTasks(allTasks.filter(t => t.childId === childId));
      } else {
        setTasks(allTasks);
      }
    } catch (error) {
      console.error('Error loading tasks:', error);
      setTasks([]);
    }
  }, [childId]);

  // Load notifications from storage
  const loadNotifications = useCallback(() => {
    try {
      const stored = localStorage.getItem(NOTIFICATIONS_KEY);
      const allNotifications: TaskNotification[] = stored ? JSON.parse(stored) : [];
      if (childId) {
        setNotifications(allNotifications.filter(n => n.childId === childId));
      } else {
        setNotifications(allNotifications);
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
      setNotifications([]);
    }
  }, [childId]);

  useEffect(() => {
    loadTasks();
    loadNotifications();
    setLoading(false);

    // Listen for storage changes (cross-tab sync)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === TASKS_KEY) loadTasks();
      if (e.key === NOTIFICATIONS_KEY) loadNotifications();
    };

    const hasListenerApi = typeof (globalThis as { addEventListener?: unknown }).addEventListener === 'function';
    if (hasListenerApi) {
      const listenerTarget = globalThis as Window;
      listenerTarget.addEventListener('storage', handleStorageChange);
      return () => listenerTarget.removeEventListener('storage', handleStorageChange);
    }
    return undefined;
  }, [loadTasks, loadNotifications]);

  // Add a new task
  const addTask = useCallback((task: Omit<Task, 'id' | 'createdAt' | 'completed'>) => {
    const newTask: Task = {
      ...task,
      id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
      completed: false,
      createdAt: new Date().toISOString(),
    };

    const stored = localStorage.getItem(TASKS_KEY);
    const allTasks: Task[] = stored ? JSON.parse(stored) : [];
    allTasks.push(newTask);
    localStorage.setItem(TASKS_KEY, JSON.stringify(allTasks));
    loadTasks();
    return newTask;
  }, [loadTasks]);

  // Update a task
  const updateTask = useCallback((taskId: string, updates: Partial<Task>) => {
    const stored = localStorage.getItem(TASKS_KEY);
    const allTasks: Task[] = stored ? JSON.parse(stored) : [];
    const index = allTasks.findIndex(t => t.id === taskId);
    if (index !== -1) {
      allTasks[index] = { ...allTasks[index], ...updates };
      localStorage.setItem(TASKS_KEY, JSON.stringify(allTasks));
      loadTasks();
    }
  }, [loadTasks]);

  // Delete a task
  const deleteTask = useCallback((taskId: string) => {
    const stored = localStorage.getItem(TASKS_KEY);
    const allTasks: Task[] = stored ? JSON.parse(stored) : [];
    const filtered = allTasks.filter(t => t.id !== taskId);
    localStorage.setItem(TASKS_KEY, JSON.stringify(filtered));
    loadTasks();
  }, [loadTasks]);

  // Submit emotional feedback for a task
  const submitFeedback = useCallback(async (
    taskId: string,
    feedback: EmotionalFeedback,
    childName: string
  ) => {
    // Update the task with feedback
    const stored = localStorage.getItem(TASKS_KEY);
    const allTasks: Task[] = stored ? JSON.parse(stored) : [];
    const taskIndex = allTasks.findIndex(t => t.id === taskId);
    
    if (taskIndex !== -1) {
      const task = allTasks[taskIndex];
      allTasks[taskIndex] = { 
        ...task, 
        completed: true, 
        emotionalFeedback: feedback 
      };
      localStorage.setItem(TASKS_KEY, JSON.stringify(allTasks));

      // Create notification for parent
      const notification: TaskNotification = {
        id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
        taskId: task.id,
        childId: task.childId,
        childName,
        taskTitle: task.title,
        feedback,
        read: false,
        createdAt: new Date().toISOString(),
      };

      const storedNotifs = localStorage.getItem(NOTIFICATIONS_KEY);
      const allNotifications: TaskNotification[] = storedNotifs ? JSON.parse(storedNotifs) : [];
      allNotifications.unshift(notification);
      localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(allNotifications));

      loadTasks();
      loadNotifications();

      const childIdForApi = task.childId || childId;
      if (childIdForApi && /^\d+$/.test(childIdForApi)) {
        try {
          const response = await fetch(buildBackendUrl(`/child/${childIdForApi}/task-response`), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              task_name: task.title,
              stress_level: feedback.stressLevel,
              emotion: feedback.emotion,
            }),
          });

          if (!response.ok) {
            const payload = await response.json().catch(() => null);
            throw new Error(payload?.error || 'Failed to log task response');
          }
        } catch (error) {
          console.error('Task response logging failed:', error);
        }
      }
    }
  }, [childId, loadTasks, loadNotifications]);

  // Mark notification as read
  const markNotificationRead = useCallback((notificationId: string) => {
    const stored = localStorage.getItem(NOTIFICATIONS_KEY);
    const allNotifications: TaskNotification[] = stored ? JSON.parse(stored) : [];
    const index = allNotifications.findIndex(n => n.id === notificationId);
    if (index !== -1) {
      allNotifications[index].read = true;
      localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(allNotifications));
      loadNotifications();
    }
  }, [loadNotifications]);

  const deleteNotification = useCallback((notificationId: string) => {
    const stored = localStorage.getItem(NOTIFICATIONS_KEY);
    const allNotifications: TaskNotification[] = stored ? JSON.parse(stored) : [];
    const filtered = allNotifications.filter(n => n.id !== notificationId);
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(filtered));
    loadNotifications();
  }, [loadNotifications]);

  const clearChildEntries = useCallback((targetChildId: string) => {
    if (!targetChildId) {
      return;
    }

    try {
      const storedTasks = localStorage.getItem(TASKS_KEY);
      if (storedTasks) {
        const allTasks: Task[] = JSON.parse(storedTasks);
        const filteredTasks = allTasks.filter(task => task.childId !== targetChildId);
        if (filteredTasks.length !== allTasks.length) {
          localStorage.setItem(TASKS_KEY, JSON.stringify(filteredTasks));
        }
      }
    } catch (error) {
      console.error('Error clearing child tasks:', error);
    }

    try {
      const storedNotifications = localStorage.getItem(NOTIFICATIONS_KEY);
      if (storedNotifications) {
        const allNotifications: TaskNotification[] = JSON.parse(storedNotifications);
        const filteredNotifications = allNotifications.filter(notification => notification.childId !== targetChildId);
        if (filteredNotifications.length !== allNotifications.length) {
          localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(filteredNotifications));
        }
      }
    } catch (error) {
      console.error('Error clearing child notifications:', error);
    }

    loadTasks();
    loadNotifications();
  }, [loadTasks, loadNotifications]);

  // Get today's tasks for a child
  const getTodaysTasks = useCallback((forChildId: string) => {
    const today = new Date().toISOString().split('T')[0];
    return tasks.filter(t => t.childId === forChildId && t.date === today);
  }, [tasks]);

  // Get unread notifications count
  const unreadCount = notifications.filter(n => !n.read).length;

  return {
    tasks,
    notifications,
    loading,
    addTask,
    updateTask,
    deleteTask,
    submitFeedback,
    markNotificationRead,
    deleteNotification,
    getTodaysTasks,
    unreadCount,
    refreshTasks: loadTasks,
    refreshNotifications: loadNotifications,
    clearChildEntries,
  };
};

export type TaskStorageApi = ReturnType<typeof useTaskStorage>;
