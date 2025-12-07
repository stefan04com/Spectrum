import { useState } from 'react';
import { useToast } from '@parent/hooks/use-toast';
import { Button } from '@parent/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@parent/components/ui/card';
import { Input } from '@parent/components/ui/input';
import { Label } from '@parent/components/ui/label';
import { Textarea } from '@parent/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@parent/components/ui/radio-group';
import { AvatarTraits, ChildProfile } from '@parent/types';
import { DEFAULT_TRAITS } from '@parent/hooks/useChildProfile';
import { buildBackendUrl } from '@parent/lib/api';
import { getAvatarPreviewEmoji } from '@parent/utils/avatarPreview';

const hairOptions = [
  { value: 'long_brown', label: 'Long & Brown' },
  { value: 'short_brown', label: 'Short & Brown' },
  { value: 'curly_black', label: 'Curly & Black' },
  { value: 'short_blonde', label: 'Short & Blonde' },
];

const skinOptions = [
  { value: 'light', label: 'Light', icon: '🧒🏻' },
  { value: 'medium', label: 'Medium', icon: '🧒🏽' },
  { value: 'dark', label: 'Deep', icon: '🧒🏿' },
];

const genderOptions = [
  { value: 'female', label: 'Girl', emoji: '👧' },
  { value: 'male', label: 'Boy', emoji: '👦' },
  { value: 'nonbinary', label: 'Non-binary', emoji: '🧑' },
];

const disabilities = [
  'Autism Level I',
  'Autism Level II',
  'Autism Level III',
  'ADHD',
  'Sensory Processing Disorder',
  'Other',
];

interface ChildOnboardingWizardProps {
  parentId: number;
  onChildCreated: (child: any) => void;
}

export const ChildOnboardingWizard = ({ parentId, onChildCreated }: ChildOnboardingWizardProps) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [profile, setProfile] = useState<ChildProfile>({
    name: '',
    age: 0,
    disability: disabilities[0],
    notes: '',
    traits: { ...DEFAULT_TRAITS },
  } as ChildProfile);
  const [customDisability, setCustomDisability] = useState('');

  const handleTraitChange = (field: keyof AvatarTraits, value: string | boolean) => {
    setProfile(prev => ({
      ...prev,
      traits: {
        ...prev.traits,
        [field]: value,
      },
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    const disabilityValue = profile.disability === 'Other' ? customDisability : profile.disability;

    try {
      const response = await fetch(buildBackendUrl('/child/create'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parent_id: parentId,
          name: profile.name,
          age: profile.age,
          disability: disabilityValue,
          traits: profile.traits,
          notes: profile.notes,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Could not create child');
      }

      toast({
        title: `Welcome, ${profile.name}!`,
        description: 'We saved this profile and avatars can now use these traits.',
      });

      onChildCreated(data.child);
    } catch (error) {
      console.error('Child creation error:', error);
      toast({
        title: 'Could not save child',
        description: error instanceof Error ? error.message : 'Unexpected error',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="max-w-3xl mx-auto shadow-soft border-primary/10">
      <CardHeader>
        <CardTitle>Let’s set up your child</CardTitle>
        <CardDescription>
          We’ll ask a few questions so the games feel personal and supportive from day one.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="child-name">Child’s name</Label>
              <Input
                id="child-name"
                value={profile.name}
                onChange={event => setProfile(prev => ({ ...prev, name: event.target.value }))}
                placeholder="Alex"
                required
              />
            </div>
            <div>
              <Label htmlFor="child-age">Age</Label>
              <Input
                id="child-age"
                type="number"
                min={1}
                max={18}
                value={profile.age === 0 ? '' : profile.age}
                onChange={event => setProfile(prev => ({ ...prev, age: Number(event.target.value) }))}
                placeholder="7"
                required
              />
            </div>
          </div>

          <div>
            <Label>Primary diagnosis</Label>
            <RadioGroup
              className="grid md:grid-cols-3 gap-3"
              value={profile.disability}
              onValueChange={value => setProfile(prev => ({ ...prev, disability: value }))}
            >
              {disabilities.map(option => (
                <Label
                  key={option}
                  className="flex flex-col rounded-2xl border border-border p-4 cursor-pointer hover:border-primary/40"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value={option} id={`disability-${option}`} />
                    <span>{option}</span>
                  </div>
                  {option === 'Other' && profile.disability === 'Other' && (
                    <Input
                      className="mt-2"
                      placeholder="Describe the diagnosis"
                      value={customDisability}
                      onChange={event => setCustomDisability(event.target.value)}
                    />
                  )}
                </Label>
              ))}
            </RadioGroup>
          </div>

          <div>
            <Label>Goals</Label>
            <Textarea
              placeholder="Anything that helps us support your child better"
              value={profile.notes ?? ''}
              onChange={event => setProfile(prev => ({ ...prev, notes: event.target.value }))}
              rows={3}
            />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <div>
                <Label>Gender expression</Label>
                <div className="grid grid-cols-3 gap-3">
                  {genderOptions.map(option => {
                    const previewEmoji = getAvatarPreviewEmoji({
                      ...profile.traits,
                      gender: option.value as AvatarTraits['gender'],
                    });
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => handleTraitChange('gender', option.value)}
                        className={`rounded-2xl border p-3 flex flex-col items-center gap-1 ${
                          profile.traits.gender === option.value
                            ? 'border-primary bg-primary/10 text-primary shadow-soft'
                            : 'border-border hover:border-primary/40'
                        }`}
                      >
                        <span className="text-3xl">{previewEmoji}</span>
                        <span className="text-sm font-medium">{option.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <Label>Hair style</Label>
                <div className="grid grid-cols-2 gap-3">
                  {hairOptions.map(option => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleTraitChange('hair', option.value)}
                      className={`rounded-2xl border p-3 text-left ${
                        profile.traits.hair === option.value
                          ? 'border-primary bg-primary/10 text-primary shadow-soft'
                          : 'border-border hover:border-primary/40'
                      }`}
                    >
                      <span className="text-sm font-semibold">{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label>Skin tone</Label>
                <div className="grid grid-cols-3 gap-3">
                  {skinOptions.map(option => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleTraitChange('skin', option.value)}
                      className={`rounded-2xl border p-3 text-left ${
                        profile.traits.skin === option.value
                          ? 'border-primary bg-primary/10 text-primary shadow-soft'
                          : 'border-border hover:border-primary/40'
                      }`}
                    >
                      <div className="flex flex-col items-start gap-1">
                        <span className="text-2xl" aria-hidden>
                          {option.icon}
                        </span>
                        <span className="text-sm font-semibold">{option.label}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <Label>Quick preview</Label>
              <div className="rounded-3xl border bg-muted/40 p-6">
                <div className="flex items-center gap-4">
                  <div className="flex h-24 w-24 items-center justify-center rounded-full border bg-background">
                    <span className="text-4xl" aria-label="Child avatar preview">
                      {getAvatarPreviewEmoji(profile.traits)}
                    </span>
                  </div>
                  <div>
                    <p className="text-lg font-semibold">{profile.name || 'Your child'}</p>
                    <p className="text-sm text-muted-foreground">
                      Disability: {profile.disability === 'Other' ? customDisability : profile.disability}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Hair: {profile.traits.hair.replace('_', ' ')} · Skin: {profile.traits.skin}
                    </p>
                  </div>
                </div>
                <p className="mt-4 text-xs text-muted-foreground">
                  These settings only inform the AI avatar; we never use real photos.
                </p>
              </div>
            </div>
          </div>

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Creating...' : 'Create profile'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
