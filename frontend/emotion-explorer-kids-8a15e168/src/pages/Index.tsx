import { useNavigate } from 'react-router-dom';
import { GameCard } from '@/components/GameCard';

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="text-center mb-12 animate-pop">
        <h1 className="text-3xl md:text-5xl font-extrabold text-foreground mb-4">
          👋 Welcome!
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground">
          What would you like to do today?
        </p>
      </div>

      <div className="flex flex-wrap gap-8 justify-center">
        <GameCard
          title="Tasks"
          emoji="📋"
          description="Complete your daily tasks"
          onClick={() => navigate('/child/tasks')}
        />
        <GameCard
          title="Games"
          emoji="🎮"
          description="Play fun learning games"
          onClick={() => navigate('/child/games')}
        />
        <GameCard
          title="Speech Helper"
          emoji="🗣️"
          description="Help me communicate"
          onClick={() => navigate('/child/speech')}
        />
        <GameCard
          title="Virtual Friend"
          emoji="🧸"
          description="Talk with your calm buddy"
          onClick={() => navigate('/child/friend')}
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

export default Index;