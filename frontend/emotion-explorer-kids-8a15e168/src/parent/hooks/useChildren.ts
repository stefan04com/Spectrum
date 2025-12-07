import { useCallback, useEffect, useMemo, useState } from 'react';
import { Child, ChildProfile } from '@parent/types';
import { buildBackendUrl } from '@parent/lib/api';
import { useToast } from '@parent/hooks/use-toast';
import { getAvatarPreviewEmoji } from '@parent/utils/avatarPreview';
import { DEFAULT_TRAITS } from '@parent/hooks/useChildProfile';

export interface BackendChildPayload {
  child_id: number;
  parent_id: number;
  name: string;
  age: number;
  disability: string;
  level?: string;
  created_at?: string;
  profile?: ChildProfile;
  avatar?: {
    base_avatar: string;
    emotions: Record<string, string>;
  } | null;
  has_avatar?: boolean;
}

const resolveTraits = (profile?: ChildProfile) => ({
  gender: profile?.traits?.gender ?? DEFAULT_TRAITS.gender,
  skin: profile?.traits?.skin ?? DEFAULT_TRAITS.skin,
  hair: profile?.traits?.hair ?? DEFAULT_TRAITS.hair,
  glasses: typeof profile?.traits?.glasses === 'boolean' ? profile.traits.glasses : DEFAULT_TRAITS.glasses,
});

const mapChild = (payload: BackendChildPayload): Child => {
  const traits = resolveTraits(payload.profile);
  return {
    id: String(payload.child_id),
    name: payload.name,
    age: payload.age,
    avatar: getAvatarPreviewEmoji(traits),
    lastActivity: payload.created_at ?? new Date().toISOString(),
    disability: payload.disability,
    profile: payload.profile,
    hasAvatar: Boolean(payload.has_avatar),
  };
};

export const useChildren = (parentId: number | string) => {
  const [children, setChildren] = useState<Child[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const normalizedParentId = useMemo(() => Number(parentId), [parentId]);

  const fetchChildren = useCallback(async () => {
    if (!normalizedParentId || Number.isNaN(normalizedParentId)) {
      setChildren([]);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(buildBackendUrl(`/child?parent_id=${normalizedParentId}`));
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to load children');
      }

      setChildren((data?.children || []).map(mapChild));
    } catch (error) {
      console.error('Children fetch error:', error);
      toast({
        title: 'Error loading children',
        description: error instanceof Error ? error.message : 'Unexpected server error',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [normalizedParentId, toast]);

  useEffect(() => {
    fetchChildren();
  }, [fetchChildren]);

  const addChild = useCallback((payload: BackendChildPayload) => {
    setChildren(prev => {
      const next = mapChild(payload);
      return [...prev, next];
    });
  }, []);

  const refreshChild = useCallback((payload: BackendChildPayload) => {
    setChildren(prev => {
      const next = mapChild(payload);
      return prev.map(child => (child.id === next.id ? next : child));
    });
  }, []);

  const deleteChild = useCallback(async (childId: string | number) => {
    const numericId = Number(childId);
    if (!numericId || Number.isNaN(numericId)) {
      throw new Error('Invalid child id');
    }

    const response = await fetch(buildBackendUrl(`/child/${numericId}`), {
      method: 'DELETE',
    });
    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(body?.error || 'Failed to delete child');
    }

    setChildren(prev => prev.filter(child => child.id !== String(numericId)));
    return body;
  }, []);

  return {
    children,
    isLoading,
    refresh: fetchChildren,
    addChild,
    refreshChild,
    deleteChild,
  };
};
