import { useCallback, useEffect, useState } from 'react';
import { buildBackendUrl } from '@/lib/api';

export interface AvatarEmotionsMap {
  happy?: string;
  sad?: string;
  angry?: string;
  scared?: string;
  calm?: string;
  [key: string]: string | undefined;
}

export interface ChildAvatarPayload {
  base_avatar: string;
  emotions: AvatarEmotionsMap;
}

const normalizeChildId = (value?: string | number | null) => {
  if (value === undefined || value === null) return null;
  const numeric = typeof value === 'string' ? Number.parseInt(value, 10) : value;
  return Number.isFinite(numeric) ? Number(numeric) : null;
};

export const useChildAvatar = (childId?: string | number | null) => {
  const normalizedId = normalizeChildId(childId);
  const [avatar, setAvatar] = useState<ChildAvatarPayload | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateAvatar = useCallback(async () => {
    if (!normalizedId) return null;
    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch(buildBackendUrl(`/child/${normalizedId}/avatar/create`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to generate avatar');
      }
      setAvatar(payload.data);
      return payload.data as ChildAvatarPayload;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate avatar');
      throw err;
    } finally {
      setIsGenerating(false);
    }
  }, [normalizedId]);

  const fetchAvatar = useCallback(async () => {
    if (!normalizedId) {
      setAvatar(null);
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(buildBackendUrl(`/child/${normalizedId}/avatar`));

      if (response.status === 404) {
        await response.json().catch(() => ({}));
        return await generateAvatar();
      }

      const body = await response.json().catch(() => ({}));
      if (response.ok) {
        setAvatar(body);
        return body as ChildAvatarPayload;
      }

      throw new Error(body.error || 'Failed to load avatar');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load avatar');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [normalizedId, generateAvatar]);

  useEffect(() => {
    if (!normalizedId) return;
    fetchAvatar();
  }, [normalizedId, fetchAvatar]);

  return {
    avatar,
    isLoading,
    isGenerating,
    error,
    refresh: fetchAvatar,
    regenerate: generateAvatar,
    hasAvatar: Boolean(avatar),
  };
};
