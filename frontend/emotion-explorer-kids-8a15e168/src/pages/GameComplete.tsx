import { useNavigate, useLocation } from 'react-router-dom';
import { LevelResult } from '@/types/game';
import { cn } from '@/lib/utils';
import { Home, RotateCcw } from 'lucide-react';

const GameComplete = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const results = (location.state as { results?: LevelResult[] })?.results || [];

  const correctCount = results.filter(r => r.isCorrect).length;
  const totalCount = results.length;
  const percentage = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;

  const getMessage = () => {
    if (percentage >= 80) return { emoji: '🏆', text: 'Excellent! You are a champion!' };
    if (percentage >= 60) return { emoji: '🌟', text: 'Very good! Keep it up!' };
    if (percentage >= 40) return { emoji: '💪', text: 'Good job! You can do even better!' };
    return { emoji: '🌈', text: 'You finished! Try again!' };
  };

  const message = getMessage();

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="text-center animate-pop">
        <span className="text-8xl md:text-9xl block mb-6">{message.emoji}</span>
        <h1 className="text-3xl md:text-4xl font-extrabold text-foreground mb-4">
          Game Complete!
        </h1>
        <p className="text-xl text-muted-foreground mb-8">{message.text}</p>
      </div>

      <div className="bg-card rounded-3xl p-8 shadow-game mb-8 animate-pop" style={{ animationDelay: '0.1s' }}>
        <div className="text-center">
          <p className="text-muted-foreground mb-2">Your Score</p>
          <p className="text-5xl md:text-6xl font-extrabold text-primary mb-2">
            {correctCount}/{totalCount}
          </p>
          <p className="text-2xl font-bold text-secondary-foreground">{percentage}%</p>
        </div>
      </div>

      <div className="flex gap-4 animate-pop" style={{ animationDelay: '0.2s' }}>
        <button
          onClick={() => navigate('/child/levels')}
          className={cn(
            'flex items-center gap-2 px-6 py-4 rounded-2xl',
            'bg-secondary text-secondary-foreground font-bold',
            'shadow-game hover:shadow-game-hover hover:scale-105 active:scale-95',
            'transition-all duration-300'
          )}
        >
          <RotateCcw className="w-5 h-5" />
          Play Again
        </button>
        <button
          onClick={() => navigate('/child')}
          className={cn(
            'flex items-center gap-2 px-6 py-4 rounded-2xl',
            'bg-primary text-primary-foreground font-bold',
            'shadow-game hover:shadow-game-hover hover:scale-105 active:scale-95',
            'transition-all duration-300'
          )}
        >
          <Home className="w-5 h-5" />
          Home
        </button>
      </div>

      <div className="mt-12 flex gap-3">
        <span className="text-4xl animate-bounce-soft" style={{ animationDelay: '0s' }}>⭐</span>
        <span className="text-4xl animate-bounce-soft" style={{ animationDelay: '0.15s' }}>🎉</span>
        <span className="text-4xl animate-bounce-soft" style={{ animationDelay: '0.3s' }}>🌟</span>
        <span className="text-4xl animate-bounce-soft" style={{ animationDelay: '0.45s' }}>✨</span>
      </div>
    </div>
  );
};

export default GameComplete;
