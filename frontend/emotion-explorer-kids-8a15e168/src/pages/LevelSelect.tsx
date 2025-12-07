import { useNavigate } from 'react-router-dom';
import { LevelButton } from '@/components/LevelButton';
import { gameLevels } from '@/data/levels';
import { ArrowLeft } from 'lucide-react';

const LevelSelect = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col items-center p-6">
      <button
        onClick={() => navigate('/child')}
        className="self-start flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8"
      >
        <ArrowLeft className="w-5 h-5" />
        <span className="font-semibold">Back</span>
      </button>

      <div className="text-center mb-12 animate-pop">
        <h1 className="text-3xl md:text-4xl font-extrabold text-foreground mb-4">
          🎭 Emotion Recognition
        </h1>
        <p className="text-lg text-muted-foreground">
          Choose a level to start
        </p>
      </div>

      <div className="grid grid-cols-5 gap-4 md:gap-6 max-w-lg">
        {gameLevels.map((level) => (
          <LevelButton
            key={level.id}
            level={level.id}
            onClick={() => navigate(`/child/play/${level.id}`)}
          />
        ))}
      </div>

      <div className="mt-16 text-center">
        <p className="text-muted-foreground mb-4">There are {gameLevels.length} levels to play!</p>
        <div className="flex gap-2 justify-center">
          <span className="text-3xl">🏆</span>
          <span className="text-3xl">🎉</span>
          <span className="text-3xl">💪</span>
        </div>
      </div>
    </div>
  );
};

export default LevelSelect;
