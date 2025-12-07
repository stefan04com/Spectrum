import { useCallback, useEffect, useState } from 'react';
import { AvatarTraits, ChildProfile } from '@parent/types';
import { useToast } from '@parent/hooks/use-toast';
import { buildBackendUrl } from '@parent/lib/api';

const FALLBACK_PROFILE: ChildProfile = {
  name: '',
  age: 0,
  notes: '',
  guidance: '',
  traits: {
    gender: 'female',
    hair: 'long_brown',
    skin: 'light',
    glasses: false,
  },
};

export const DEFAULT_TRAITS: AvatarTraits = { ...FALLBACK_PROFILE.traits };

const ensureNumber = (value: unknown, fallback = 0) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeTraits = (traits?: Partial<AvatarTraits>): AvatarTraits => ({
  gender: traits?.gender ?? DEFAULT_TRAITS.gender,
  hair: traits?.hair ?? DEFAULT_TRAITS.hair,
  skin: traits?.skin ?? DEFAULT_TRAITS.skin,
  glasses: typeof traits?.glasses === 'boolean' ? traits.glasses : DEFAULT_TRAITS.glasses,
});

const normalizeProfile = (profile?: Partial<ChildProfile>): ChildProfile => ({
  name: profile?.name ?? FALLBACK_PROFILE.name,
  age: ensureNumber(profile?.age, FALLBACK_PROFILE.age),
  notes: profile?.notes ?? FALLBACK_PROFILE.notes,
  guidance: profile?.guidance ?? FALLBACK_PROFILE.guidance,
  traits: normalizeTraits(profile?.traits),
});

const readJson = async (response: Response) => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

interface SaveOptions {
  silent?: boolean;
}

export const useChildProfile = (childId?: string | number | null) => {
  const [profile, setProfile] = useState<ChildProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const resolvedId = childId ?? null;

  const fetchProfile = useCallback(async () => {
    if (!resolvedId) {
      setProfile(null);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(buildBackendUrl(`/child/${resolvedId}/profile`));
      if (response.status === 404) {
        setProfile(null);
        return;
      }

      const payload = await readJson(response);
      if (!response.ok) {
        throw new Error(payload?.error || 'Unable to load profile');
      }

      setProfile(normalizeProfile(payload?.profile ?? payload));
    } catch (error) {
      console.error('Profile fetch error:', error);
      toast({
        title: 'Profile error',
        description: error instanceof Error ? error.message : 'Failed to load profile details',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [resolvedId, toast]);

  useEffect(() => {
    setProfile(null);
    fetchProfile();
  }, [fetchProfile, resolvedId]);

  const saveProfile = useCallback(
    async (nextProfile: ChildProfile, options: SaveOptions = {}) => {
      if (!resolvedId) {
        toast({
          title: 'Select a child first',
          description: 'Choose a child from the sidebar to edit their profile.',
          variant: 'destructive',
        });
        return null;
      }

      setIsSaving(true);
      try {
        const response = await fetch(buildBackendUrl(`/child/${resolvedId}/profile`), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: nextProfile.name,
            age: nextProfile.age,
            notes: nextProfile.notes ?? '',
            traits: nextProfile.traits,
          }),
        });

        const payload = await readJson(response);
        if (!response.ok) {
          throw new Error(payload?.error || 'Unable to save profile');
        }

        const normalized = normalizeProfile(payload?.profile ?? payload);
        setProfile(normalized);

        if (!options.silent) {
          toast({
            title: 'Profile saved',
            description: 'We will use these traits when generating avatars.',
          });
        }

        return normalized;
      } catch (error) {
        console.error('Profile save error:', error);
        toast({
          title: 'Could not save profile',
          description: error instanceof Error ? error.message : 'Unexpected error',
          variant: 'destructive',
        });
        throw error;
      } finally {
        setIsSaving(false);
      }
    },
    [resolvedId, toast]
  );

  const generateAvatar = useCallback(
    async (traits?: AvatarTraits) => {
      if (!resolvedId) {
        toast({
          title: 'Select a child first',
          description: 'Choose a child before generating an avatar.',
          variant: 'destructive',
        });
        return null;
      }

      setIsGenerating(true);
      try {
        const response = await fetch(buildBackendUrl(`/child/${resolvedId}/avatar/create`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(traits ? { traits } : {}),
        });

        const payload = await readJson(response);
        if (!response.ok) {
          throw new Error(payload?.error || 'Unable to generate avatar');
        }

        toast({
          title: 'Avatar requested',
          description: 'Give us a moment to craft the new emotion set.',
        });

        return payload;
      } catch (error) {
        console.error('Avatar generation error:', error);
        toast({
          title: 'Avatar generation failed',
          description: error instanceof Error ? error.message : 'Unexpected error',
          variant: 'destructive',
        });
        throw error;
      } finally {
        setIsGenerating(false);
      }
    },
    [resolvedId, toast]
  );

  return {
    profile,
    isLoadingProfile: isLoading,
    isSavingProfile: isSaving,
    isGeneratingAvatar: isGenerating,
    refreshProfile: fetchProfile,
    saveProfile,
    generateAvatar,
  };
};
