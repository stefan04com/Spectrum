import { cn } from '@/lib/utils';

interface GameCardProps {
  title: string;
  emoji: string;
  description: string;
  onClick: () => void;
}

export const GameCard = ({ title, emoji, description, onClick }: GameCardProps) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        'group flex flex-col items-center justify-center p-8 md:p-12',
        'bg-card rounded-3xl shadow-game hover:shadow-game-hover',
        'transition-all duration-300 hover:scale-105 active:scale-95',
        'border-2 border-primary/20 hover:border-primary/40',
        'min-w-[280px] md:min-w-[320px]'
      )}
    >
      <span className="text-6xl md:text-8xl mb-4 group-hover:animate-bounce-soft">{emoji}</span>
      <h2 className="text-xl md:text-2xl font-bold text-foreground mb-2">{title}</h2>
      <p className="text-sm md:text-base text-muted-foreground text-center">{description}</p>
    </button>
  );
};
