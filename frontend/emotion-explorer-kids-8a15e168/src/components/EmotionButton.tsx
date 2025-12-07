import { cn } from '@/lib/utils';
import { Emotion } from '@/types/game';

interface EmotionButtonProps {
  emotion: Emotion;
  onClick: (emotion: Emotion) => void;
  selected?: boolean;
  disabled?: boolean;
  showResult?: 'correct' | 'incorrect' | null;
}

const emotionConfig: Record<Emotion, { emoji: string; label: string; bgClass: string }> = {
  joy: { emoji: '😊', label: 'Joy', bgClass: 'bg-emotion-joy hover:bg-emotion-joy/90' },
  sadness: { emoji: '😢', label: 'Sadness', bgClass: 'bg-emotion-sadness hover:bg-emotion-sadness/90' },
  anger: { emoji: '😠', label: 'Anger', bgClass: 'bg-emotion-anger hover:bg-emotion-anger/90' },
  fear: { emoji: '😨', label: 'Fear', bgClass: 'bg-emotion-fear hover:bg-emotion-fear/90' },
  disgust: { emoji: '🤢', label: 'Disgust', bgClass: 'bg-emotion-disgust hover:bg-emotion-disgust/90' },
  surprise: { emoji: '😲', label: 'Surprise', bgClass: 'bg-emotion-surprise hover:bg-emotion-surprise/90' },
};

export const EmotionButton = ({ emotion, onClick, selected, disabled, showResult }: EmotionButtonProps) => {
  const config = emotionConfig[emotion];

  return (
    <button
      onClick={() => onClick(emotion)}
      disabled={disabled}
      className={cn(
        'flex flex-col items-center justify-center p-4 md:p-6 rounded-2xl transition-all duration-300',
        'shadow-emotion hover:shadow-game-hover hover:scale-105 active:scale-95',
        'min-w-[100px] md:min-w-[120px]',
        config.bgClass,
        selected && 'ring-4 ring-foreground/30 scale-105',
        showResult === 'correct' && 'ring-4 ring-game-success animate-success',
        showResult === 'incorrect' && 'ring-4 ring-game-error animate-wiggle',
        disabled && 'opacity-70 cursor-not-allowed hover:scale-100'
      )}
    >
      <span className="text-4xl md:text-5xl mb-2">{config.emoji}</span>
      <span className="text-sm md:text-base font-semibold text-foreground/90">{config.label}</span>
    </button>
  );
};
