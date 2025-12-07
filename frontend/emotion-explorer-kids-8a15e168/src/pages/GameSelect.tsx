import { useNavigate } from 'react-router-dom';
import { GameCard } from '@/components/GameCard';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

const GameSelect = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <Button
        onClick={() => navigate('/child')}
        variant="ghost"
        className="absolute top-4 left-4 text-lg rounded-2xl"
      >
        <ArrowLeft className="w-5 h-5 mr-2" />
        Back
      </Button>

      <div className="text-center mb-12 animate-pop">
        <h1 className="text-3xl md:text-5xl font-extrabold text-foreground mb-4">
          🎮 Choose a Game
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground">
          Tap on the game you want to play
        </p>
      </div>

      <div className="flex flex-wrap gap-8 justify-center">
        <GameCard
          title="Emotion Recognition"
          emoji="🎭"
          description="Learn to recognize emotions in pictures"
          onClick={() => navigate('/child/levels')}
        />
        <GameCard
          title="Routine Builder"
          emoji="🧘‍♀️"
          description="Arrange calm steps and listen to the guidance"
          onClick={() => navigate('/child/routine')}
        />
      </div>

      <div className="mt-16 flex gap-4">
        <span className="text-4xl animate-bounce-soft" style={{ animationDelay: '0s' }}>⭐</span>
        <span className="text-4xl animate-bounce-soft" style={{ animationDelay: '0.2s' }}>🌈</span>
        <span className="text-4xl animate-bounce-soft" style={{ animationDelay: '0.4s' }}>✨</span>
      </div>
    </div>
  );
};

export default GameSelect;
