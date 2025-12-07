import { useCallback, useEffect, useState } from 'react';
import { buildBackendUrl } from '@parent/lib/api';
import { useToast } from '@parent/hooks/use-toast';
import { TaskEmotionStats } from '@parent/types';

const mapStats = (payload: any, fallbackChildId?: string | null): TaskEmotionStats => {
  return {
    childId: String(payload?.child_id ?? fallbackChildId ?? ''),
    totalLogs: Number(payload?.total_logs ?? 0),
    emotionCounts: payload?.emotion_counts ?? {},
    daysWindow: payload?.days_window ?? null,
  };
};

export const useTaskEmotionStats = (childId?: string | null, days?: number) => {
  const [stats, setStats] = useState<TaskEmotionStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const fetchStats = useCallback(async () => {
    if (!childId) {
      setStats(null);
      return;
    }

    setIsLoading(true);
    try {
      const query = typeof days === 'number' ? `?days=${Math.max(1, Math.floor(days))}` : '';
      const response = await fetch(buildBackendUrl(`/parent/child/${childId}/task-emotions${query}`));
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.error || 'Failed to load emotion stats');
      }

      setStats(mapStats(body, childId));
    } catch (error) {
      console.error('Task emotion stats error:', error);
      toast({
        title: 'Unable to load task emotions',
        description: error instanceof Error ? error.message : 'Unexpected server error',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [childId, days, toast]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return {
    stats,
    isLoading,
    refreshStats: fetchStats,
  };
};
