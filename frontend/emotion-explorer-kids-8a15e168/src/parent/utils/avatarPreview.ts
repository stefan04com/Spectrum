import { AvatarTraits } from '@parent/types';

type GenderKey = 'female' | 'male' | 'nonbinary';

type SkinToneEmojiMap = Record<string, Record<GenderKey, string>>;

const defaultEmoji: Record<GenderKey, string> = {
  female: '👧',
  male: '👦',
  nonbinary: '🧑',
};

const skinToneEmojiMap: SkinToneEmojiMap = {
  light: {
    female: '👧🏻',
    male: '👦🏻',
    nonbinary: '🧑🏻',
  },
  medium: {
    female: '👧🏽',
    male: '👦🏽',
    nonbinary: '🧑🏽',
  },
  dark: {
    female: '👧🏿',
    male: '👦🏿',
    nonbinary: '🧑🏿',
  },
};

const normalizeGender = (gender: AvatarTraits['gender']): GenderKey => {
  if (gender === 'male') return 'male';
  if (gender === 'nonbinary') return 'nonbinary';
  return 'female';
};

const normalizeSkin = (skin?: AvatarTraits['skin']) => {
  if (!skin) return 'light';
  return skinToneEmojiMap[skin] ? skin : 'light';
};

export const getAvatarPreviewEmoji = (traits: AvatarTraits): string => {
  const genderKey = normalizeGender(traits.gender);
  const skinKey = normalizeSkin(traits.skin);
  return skinToneEmojiMap[skinKey]?.[genderKey] ?? defaultEmoji[genderKey];
};
