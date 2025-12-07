import { useMemo } from 'react';
import { Child, ChildProfile } from '@parent/types';
import { useChildProfile, DEFAULT_TRAITS } from '@parent/hooks/useChildProfile';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@parent/components/ui/card';
import { Label } from '@parent/components/ui/label';
import { Button } from '@parent/components/ui/button';
import { cn } from '@parent/lib/utils';
import { Trash2 } from 'lucide-react';
import { getAvatarPreviewEmoji } from '@parent/utils/avatarPreview';

interface ChildProfileCardProps {
  child: Child;
  onDelete?: (child: Child) => void | Promise<void>;
  isDeleting?: boolean;
}

const genderOptions = [
  { value: 'female', label: 'Girl', emoji: '👧' },
  { value: 'male', label: 'Boy', emoji: '👦' },
  { value: 'nonbinary', label: 'Non-binary', emoji: '🧑' },
];

const hairOptions = [
  { value: 'long_brown', label: 'Long & Brown' },
  { value: 'short_brown', label: 'Short & Brown' },
  { value: 'curly_black', label: 'Curly & Black' },
  { value: 'short_blonde', label: 'Short & Blonde' },
];

const skinOptions = [
  { value: 'light', label: 'Light' },
  { value: 'medium', label: 'Medium' },
  { value: 'dark', label: 'Deep' },
];

const defaultProfileForChild = (child: Child): ChildProfile => ({
  name: child.name,
  age: child.age,
  notes: '',
  guidance: '',
  traits: { ...DEFAULT_TRAITS },
});

const traitBadgeClass = (selected: boolean) =>
  cn(
    'rounded-full border px-3 py-1 text-xs font-medium transition-all',
    selected ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'
  );

export const ChildProfileCard = ({ child, onDelete, isDeleting = false }: ChildProfileCardProps) => {
  const { profile } = useChildProfile(child.id);
  const resolvedProfile: ChildProfile = profile ?? child.profile ?? defaultProfileForChild(child);

  const previewEmoji = useMemo(
    () => getAvatarPreviewEmoji(resolvedProfile.traits),
    [resolvedProfile.traits.gender, resolvedProfile.traits.skin]
  );

  const getOptionLabel = (list: { value: string; label: string }[], value: string) =>
    list.find(option => option.value === value)?.label ?? value;

  const handleDelete = async () => {
    if (!onDelete) return;
    await onDelete(child);
  };

  const displayName = (resolvedProfile.name || child.name || 'Your child').trim();
  const ageLabel = resolvedProfile.age || child.age;
  const diagnosis = child.disability || 'their learning goals';
  const goalLines = useMemo(
    () => (resolvedProfile.notes || '').split(/\n+/).map(line => line.trim()).filter(Boolean),
    [resolvedProfile.notes]
  );
  const hasGoals = goalLines.length > 0;

  const aiGuidance = resolvedProfile.guidance?.trim();
  const snapshotLabel = 'AI guidance snapshot';
  const guidanceParagraphs = aiGuidance
    ? aiGuidance.split(/\n+/).map(chunk => chunk.trim()).filter(Boolean)
    : [];
  const hasGuidance = guidanceParagraphs.length > 0;

  const traitBadges = [
    { label: 'Gender', value: resolvedProfile.traits.gender, options: genderOptions },
    { label: 'Hair', value: resolvedProfile.traits.hair, options: hairOptions },
    { label: 'Skin', value: resolvedProfile.traits.skin, options: skinOptions },
  ];

  return (
    <Card className="border-primary/10 shadow-soft">
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Child Profile</CardTitle>
          <CardDescription>
            Traits stay locked after onboarding. You can refresh goals anytime.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="rounded-3xl border border-primary/10 bg-primary/5 p-5">
            <p className="text-sm text-muted-foreground">{snapshotLabel}</p>
            {hasGuidance ? (
              <div className="mt-3 space-y-3 text-base font-medium text-foreground whitespace-pre-line">
                {guidanceParagraphs.map(text => (
                  <p key={text}>{text}</p>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                We have not generated guidance yet. Add or adjust goals, then refresh the profile to pull an AI summary.
              </p>
            )}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <div>
                <Label>Profile details</Label>
                <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                  <p><span className="font-semibold text-foreground">Preferred name:</span> {displayName}</p>
                  <p><span className="font-semibold text-foreground">Age:</span> {ageLabel || '—'}</p>
                  <p>
                    <span className="font-semibold text-foreground">Diagnosis focus:</span> {diagnosis}
                  </p>
                </div>
              </div>

              {hasGoals && (
                <div>
                  <Label htmlFor={`goals-${child.id}`}>Goals</Label>
                  <div className="mt-2 space-y-2 rounded-2xl border border-border bg-muted/40 p-3 text-sm text-foreground">
                    {goalLines.map(line => (
                      <p key={line} className="leading-relaxed">
                        {line}
                      </p>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Update goals from the onboarding flow if you need to change this focus.
                  </p>
                </div>
              )}

              <div>
                <Label>Avatar traits</Label>
                <div className="mt-3 flex flex-wrap gap-2">
                  {traitBadges.map(({ label, value, options }) => (
                    <span key={label} className={traitBadgeClass(true)}>
                      {label}: {getOptionLabel(options, value)}
                    </span>
                  ))}
                  {resolvedProfile.traits.glasses && <span className={traitBadgeClass(true)}>Glasses: yes</span>}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <Label>Instant preview</Label>
              <div className="rounded-3xl border bg-muted/40 p-5">
                <div className="flex items-center gap-4">
                  <div className="relative flex h-24 w-24 items-center justify-center rounded-full border bg-background">
                    <span className="text-4xl">{previewEmoji}</span>
                    {resolvedProfile.traits.glasses && (
                      <span className="absolute bottom-2 text-xs text-muted-foreground">👓</span>
                    )}
                  </div>
                  <div>
                    <p className="text-lg font-semibold">{displayName}</p>
                    <p className="text-sm text-muted-foreground">
                      Skin: {getOptionLabel(skinOptions, resolvedProfile.traits.skin)} · Hair:{' '}
                      {getOptionLabel(hairOptions, resolvedProfile.traits.hair)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Gender expression: {getOptionLabel(genderOptions, resolvedProfile.traits.gender)}
                    </p>
                  </div>
                </div>
                <p className="mt-4 text-xs text-muted-foreground">
                  Final artwork will come from the AI model, but this preview keeps everyone aligned on the baseline traits.
                </p>
              </div>
            </div>
          </div>

          {onDelete && (
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : (
                  <span className="inline-flex items-center gap-2">
                    <Trash2 className="h-4 w-4" /> Delete profile
                  </span>
                )}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
