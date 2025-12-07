export type Emotion = 'joy' | 'sadness' | 'anger' | 'fear' | 'disgust' | 'surprise';

export interface LevelData {
  id: number;
  imageUrl: string;
  expectedEmotion: Emotion;
}

export interface LevelResult {
  levelId: number;
  expectedEmotion: Emotion;
  selectedEmotion: Emotion | null;
  isCorrect: boolean;
  timestamp: Date;
}

export interface GameSession {
  gameId: string;
  startTime: Date;
  endTime?: Date;
  results: LevelResult[];
}
