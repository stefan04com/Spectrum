import { useState, useCallback } from 'react';
import { GameSession, LevelResult, Emotion } from '@/types/game';
import { gameLevels } from '@/data/levels';

export const useGameSession = () => {
  const [session, setSession] = useState<GameSession | null>(null);
  const [currentLevelIndex, setCurrentLevelIndex] = useState(0);

  const startSession = useCallback(() => {
    const newSession: GameSession = {
      gameId: `game-${Date.now()}`,
      startTime: new Date(),
      results: [],
    };
    setSession(newSession);
    setCurrentLevelIndex(0);
  }, []);

  const submitAnswer = useCallback((levelId: number, selectedEmotion: Emotion) => {
    if (!session) return;

    const levelData = gameLevels.find(l => l.id === levelId);
    if (!levelData) return;

    const result: LevelResult = {
      levelId,
      expectedEmotion: levelData.expectedEmotion,
      selectedEmotion,
      isCorrect: selectedEmotion === levelData.expectedEmotion,
      timestamp: new Date(),
    };

    setSession(prev => prev ? {
      ...prev,
      results: [...prev.results, result],
    } : null);

    return result;
  }, [session]);

  const endSession = useCallback(() => {
    if (!session) return null;

    const finalSession: GameSession = {
      ...session,
      endTime: new Date(),
    };

    setSession(finalSession);
    
    // Here you would send to endpoint
    console.log('Session completed:', finalSession);
    
    return finalSession;
  }, [session]);

  const goToNextLevel = useCallback(() => {
    if (currentLevelIndex < gameLevels.length - 1) {
      setCurrentLevelIndex(prev => prev + 1);
    }
  }, [currentLevelIndex]);

  const resetSession = useCallback(() => {
    setSession(null);
    setCurrentLevelIndex(0);
  }, []);

  return {
    session,
    currentLevelIndex,
    currentLevel: gameLevels[currentLevelIndex],
    totalLevels: gameLevels.length,
    startSession,
    submitAnswer,
    endSession,
    goToNextLevel,
    resetSession,
    isLastLevel: currentLevelIndex === gameLevels.length - 1,
  };
};
