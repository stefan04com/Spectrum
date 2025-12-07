import { cn } from '@/lib/utils';
import { Check, Lock } from 'lucide-react';

interface LevelButtonProps {
  level: number;
  completed?: boolean;
  locked?: boolean;
  onClick: () => void;
}

export const LevelButton = ({ level, completed, locked, onClick }: LevelButtonProps) => {
  return (
    <button
      onClick={onClick}
      disabled={locked}
      className={cn(
        'relative flex items-center justify-center w-16 h-16 md:w-20 md:h-20',
        'rounded-2xl font-bold text-xl md:text-2xl',
        'transition-all duration-300 shadow-emotion',
        completed
          ? 'bg-game-success text-primary-foreground'
          : locked
          ? 'bg-muted text-muted-foreground cursor-not-allowed'
          : 'bg-primary text-primary-foreground hover:scale-110 hover:shadow-game-hover active:scale-95'
      )}
    >
      {completed ? (
        <Check className="w-8 h-8" />
      ) : locked ? (
        <Lock className="w-6 h-6" />
      ) : (
        level
      )}
    </button>
  );
};
