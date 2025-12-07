import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { EmotionButton } from '@/components/EmotionButton';
import { ProgressBar } from '@/components/ProgressBar';
import { gameLevels } from '@/data/levels';
import { Emotion, LevelResult } from '@/types/game';
import { ArrowLeft, ArrowRight, Home } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buildBackendUrl } from '@/lib/api';
import { getStoredActiveChildId } from '@/lib/child';

const emotions: Emotion[] = ['joy', 'sadness', 'anger', 'fear', 'disgust', 'surprise'];

const GamePlay = () => {
  const navigate = useNavigate();
  const { levelId } = useParams();
  const currentLevelId = Number.parseInt(levelId ?? '1', 10);
  
  const [selectedEmotion, setSelectedEmotion] = useState<Emotion | null>(null);
  const [showResult, setShowResult] = useState<'correct' | 'incorrect' | null>(null);
  const [results, setResults] = useState<LevelResult[]>([]);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [activeChildId, setActiveChildId] = useState<string | null>(null);

  const currentLevel = gameLevels.find(l => l.id === currentLevelId);
  const isLastLevel = currentLevelId === gameLevels.length;
  const displayedImageUrl = currentLevel?.imageUrl;

  useEffect(() => {
    setSelectedEmotion(null);
    setShowResult(null);
    setIsTransitioning(false);
  }, [currentLevelId]);

  useEffect(() => {
    setActiveChildId(getStoredActiveChildId());
  }, []);

  const logLevelResult = useCallback(
    async (levelNumber: number, expectedAnswer: string, childAnswer: string) => {
      const numericChildId = Number(activeChildId);
      if (!numericChildId) return;

      try {
        const response = await fetch(buildBackendUrl(`/child/${numericChildId}/level-result`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            level: levelNumber,
            expected_answer: expectedAnswer,
            child_answer: childAnswer,
          }),
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.error || 'Level result logging failed');
        }
      } catch (error) {
        console.error('Level result logging error:', error);
      }
    },
    [activeChildId]
  );

  if (!currentLevel) {
    navigate('/child/levels');
    return null;
  }

  const getEmotionButtonResult = (emotion: Emotion) => {
    if (!showResult) return null;
    if (selectedEmotion === emotion) return showResult;
    if (emotion === currentLevel.expectedEmotion) return 'correct';
    return null;
  };

  const handleEmotionSelect = (emotion: Emotion) => {
    if (showResult || isTransitioning) return;

    setSelectedEmotion(emotion);
    const isCorrect = emotion === currentLevel.expectedEmotion;
    setShowResult(isCorrect ? 'correct' : 'incorrect');

    const result: LevelResult = {
      levelId: currentLevelId,
      expectedEmotion: currentLevel.expectedEmotion,
      selectedEmotion: emotion,
      isCorrect,
      timestamp: new Date(),
    };

    setResults(prev => [...prev, result]);
    console.log('Level result:', result);
    void logLevelResult(currentLevelId, currentLevel.expectedEmotion, emotion);
  };

  const handleNext = () => {
    if (isLastLevel) {
      // End game - log all results
      console.log('Game completed! All results:', results);
      navigate('/child/complete', { state: { results } });
    } else {
      setIsTransitioning(true);
      setTimeout(() => {
        navigate(`/child/play/${currentLevelId + 1}`);
      }, 300);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigate('/child/levels')}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-semibold hidden md:inline">Levels</span>
        </button>

        <ProgressBar current={currentLevelId} total={gameLevels.length} />

        <button
          onClick={() => navigate('/child')}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <Home className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-8">
        <div className="text-center animate-pop">
          <h2 className="text-xl md:text-2xl font-bold text-foreground mb-2">
            Level {currentLevelId}
          </h2>
          <p className="text-muted-foreground">What emotion do you see in the picture?</p>
        </div>

        <div
          className={cn(
            'relative w-full max-w-md aspect-square rounded-3xl overflow-hidden shadow-game',
            'bg-card border-4 border-primary/20',
            'transition-all duration-300',
            isTransitioning && 'opacity-0 scale-95'
          )}
        >
          {displayedImageUrl && (
            <img
              src={displayedImageUrl}
              alt={`Level ${currentLevelId} avatar`}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = currentLevel?.imageUrl || '/placeholder.svg';
              }}
            />
          )}
        </div>

        <div className="grid grid-cols-3 gap-3 md:gap-4 max-w-xl">
          {emotions.map((emotion) => (
            <EmotionButton
              key={emotion}
              emotion={emotion}
              onClick={handleEmotionSelect}
              selected={selectedEmotion === emotion}
              disabled={showResult !== null}
              showResult={getEmotionButtonResult(emotion)}
            />
          ))}
        </div>

        {showResult && (
          <div className="flex flex-col items-center gap-4 animate-pop">
            <p
              className={cn(
                'text-xl font-bold',
                showResult === 'correct' ? 'text-game-success' : 'text-game-error'
              )}
            >
              {showResult === 'correct' ? '🎉 Great job! You got it right!' : '😊 Almost! Try again next time!'}
            </p>
            <button
              onClick={handleNext}
              className={cn(
                'flex items-center gap-2 px-8 py-4 rounded-2xl',
                'bg-primary text-primary-foreground font-bold text-lg',
                'shadow-game hover:shadow-game-hover hover:scale-105 active:scale-95',
                'transition-all duration-300'
              )}
            >
              {isLastLevel ? 'Finish Game' : 'Next Level'}
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default GamePlay;
