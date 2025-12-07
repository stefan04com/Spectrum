import { useCallback, useEffect, useState } from 'react';
import { buildBackendUrl } from '@parent/lib/api';
import { useToast } from '@parent/hooks/use-toast';
import { TaskStressRecord } from '@parent/types';

const mapRecord = (raw: any): TaskStressRecord => ({
  id: Number(raw?.id ?? Date.now()),
  taskName: raw?.task_name ?? 'Task',
  stressLevel: Number(raw?.stress_level ?? 0),
  emotion: raw?.emotion ?? undefined,
  loggedAt: raw?.logged_at ?? null,
});

export const useTaskStressHistory = (childId?: string | null, limit = 5) => {
  const [records, setRecords] = useState<TaskStressRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const fetchHistory = useCallback(async () => {
    if (!childId) {
      setRecords([]);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        buildBackendUrl(`/parent/child/${childId}/task-stress-history?limit=${Math.max(1, limit)}`)
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.error || 'Failed to load stress history');
      }

      const mapped = Array.isArray(body?.records) ? body.records.map(mapRecord) : [];
      setRecords(mapped);
    } catch (error) {
      console.error('Task stress history error:', error);
      toast({
        title: 'Unable to load stress progress',
        description: error instanceof Error ? error.message : 'Unexpected server error',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [childId, limit, toast]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return {
    records,
    isLoading,
    refreshHistory: fetchHistory,
  };
};
