import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildBackendUrl } from '@parent/lib/api';
import { useToast } from '@parent/hooks/use-toast';
import { Child } from '@parent/types';

export interface ParentSummaryChild {
  id: string;
  name: string;
  age: number;
  disability?: string | null;
  level?: string | null;
  createdAt?: string | null;
  profileNotes?: string | null;
}

export interface ParentSummaryStats {
  activeAlerts: number;
  taskLogs: number;
}

export interface ParentSummary {
  parentId: number;
  name: string;
  email: string;
  childCount: number;
  stats: ParentSummaryStats;
  children: ParentSummaryChild[];
}

interface UseParentSummaryOptions {
  fallbackChildren?: Child[];
  fallbackName?: string;
  fallbackEmail?: string;
}

const EMPTY_CHILDREN: Child[] = [];

const buildFallbackSummary = (
  parentId: number,
  { fallbackChildren = [], fallbackName, fallbackEmail }: UseParentSummaryOptions,
): ParentSummary => {
  const mappedChildren: ParentSummaryChild[] = fallbackChildren.map((child) => ({
    id: child.id,
    name: child.name,
    age: child.age,
    disability: child.disability,
    level: undefined,
    createdAt: child.lastActivity,
    profileNotes: child.profile?.notes ?? null,
  }));

  return {
    parentId,
    name: fallbackName ?? 'Parent',
    email: fallbackEmail ?? 'parent@auristicare.local',
    childCount: mappedChildren.length,
    stats: {
      activeAlerts: 0,
      taskLogs: 0,
    },
    children: mappedChildren,
  };
};

export const useParentSummary = (parentId: number | string, options: UseParentSummaryOptions = {}) => {
  const [summary, setSummary] = useState<ParentSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const parentIdNumber = Number(parentId) || 0;
  const {
    fallbackChildren: providedFallbackChildren,
    fallbackName,
    fallbackEmail,
  } = options;
  const fallbackChildren = providedFallbackChildren ?? EMPTY_CHILDREN;

  const fallbackSummary = useMemo(
    () =>
      buildFallbackSummary(parentIdNumber, {
        fallbackChildren,
        fallbackName,
        fallbackEmail,
      }),
    [parentIdNumber, fallbackChildren, fallbackName, fallbackEmail],
  );
  const fallbackSummaryRef = useRef(fallbackSummary);

  useEffect(() => {
    fallbackSummaryRef.current = fallbackSummary;
  }, [fallbackSummary]);

  const fetchSummary = useCallback(async () => {
    if (!parentId) {
      setSummary(fallbackSummaryRef.current);
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch(buildBackendUrl(`/parent/${parentId}/summary`));
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to load parent profile');
      }

      const mapped: ParentSummary = {
        parentId: data.parent_id,
        name: data.name,
        email: data.email,
        childCount: data.child_count,
        stats: {
          activeAlerts: data.stats?.active_alerts ?? 0,
          taskLogs: data.stats?.task_logs ?? 0,
        },
        children: (data.children || []).map((child: any) => ({
          id: String(child.id ?? child.child_id ?? ''),
          name: child.name,
          age: child.age,
          disability: child.disability,
          level: child.level,
          createdAt: child.created_at,
          profileNotes: child.profile?.notes ?? null,
        })),
      };

      setSummary(mapped);
    } catch (error) {
      console.error('Parent summary fetch error', error);
      if (fallbackChildren.length > 0) {
        setSummary(fallbackSummaryRef.current);
      } else {
        toast({
          title: 'Parent profile unavailable',
          description: error instanceof Error ? error.message : 'Unexpected server error',
          variant: 'destructive',
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [parentId, fallbackChildren.length, toast]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  return { summary, isLoading, refresh: fetchSummary };
};
