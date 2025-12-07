import { useCallback, useEffect, useState } from 'react';
import { buildBackendUrl } from '@parent/lib/api';
import { useToast } from '@parent/hooks/use-toast';
import { ChildAlert, ChildAlertDocument, ChildAlertTask } from '@parent/types';

const mapAlertTask = (task: any): ChildAlertTask => ({
  taskName: task?.task_name ?? 'Task',
  emotion: task?.emotion ?? undefined,
  stressLevel: typeof task?.stress_level === 'number' ? task.stress_level : undefined,
  loggedAt: task?.logged_at ?? null,
});

const mapAlertDocument = (doc: any): ChildAlertDocument => ({
  source: doc?.source ?? undefined,
  pages: Array.isArray(doc?.pages) ? doc.pages : undefined,
  topics: Array.isArray(doc?.topics) ? doc.topics : undefined,
  supportContext: doc?.support_context ?? undefined,
});

const mapAlert = (raw: any): ChildAlert => ({
  id: Number(raw?.id),
  childId: String(raw?.child_id ?? ''),
  reason: raw?.reason ?? 'high_distress_sequence',
  message: raw?.message ?? '',
  acknowledged: Boolean(raw?.acknowledged),
  createdAt: raw?.created_at ?? '',
  updatedAt: raw?.updated_at ?? undefined,
  payload: raw?.payload
    ? {
        tasks: Array.isArray(raw.payload.tasks)
          ? raw.payload.tasks.map(mapAlertTask)
          : undefined,
        documents: Array.isArray(raw.payload.documents)
          ? raw.payload.documents.map(mapAlertDocument)
          : undefined,
      }
    : undefined,
});

export const useChildAlerts = (childId?: string | null) => {
  const [alerts, setAlerts] = useState<ChildAlert[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const fetchAlerts = useCallback(async () => {
    if (!childId) {
      setAlerts([]);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(buildBackendUrl(`/parent/child/${childId}/alerts`));
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.error || 'Unable to load alerts');
      }

      const mapped = Array.isArray(body?.alerts) ? body.alerts.map(mapAlert) : [];
      setAlerts(mapped);
    } catch (error) {
      console.error('Child alerts fetch error:', error);
      toast({
        title: 'Could not load alerts',
        description: error instanceof Error ? error.message : 'Unexpected server error',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [childId, toast]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const acknowledgeAlert = useCallback(
    async (alertId: number) => {
      try {
        const response = await fetch(buildBackendUrl(`/parent/alerts/${alertId}/acknowledge`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ acknowledged: true }),
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(body?.error || 'Failed to acknowledge alert');
        }

        setAlerts(prev => prev.map(alert => (alert.id === alertId ? { ...alert, acknowledged: true } : alert)));
        return mapAlert(body?.alert);
      } catch (error) {
        console.error('Child alert acknowledge error:', error);
        toast({
          title: 'Could not update alert',
          description: error instanceof Error ? error.message : 'Unexpected server error',
          variant: 'destructive',
        });
        throw error;
      }
    },
    [toast]
  );

  const activeAlert = alerts.find(alert => !alert.acknowledged) ?? null;

  return {
    alerts,
    activeAlert,
    isLoading,
    refreshAlerts: fetchAlerts,
    acknowledgeAlert,
  };
};
