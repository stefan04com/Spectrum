import { useCallback, useEffect, useRef, useState } from "react";

export type RecorderState = "idle" | "waiting" | "recording" | "stopped" | "error";

interface UseMicrophoneRecorderOptions {
  audioBitsPerSecond?: number;
  mimeType?: string;
}

interface UseMicrophoneRecorderReturn {
  state: RecorderState;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
  reset: () => void;
  audioBlob: Blob | null;
  audioUrl: string | null;
  clearAudio: () => void;
  durationMs: number;
  hasPermission: boolean;
}

export const useMicrophoneRecorder = (
  { audioBitsPerSecond = 128000, mimeType = "audio/webm" }: UseMicrophoneRecorderOptions = {},
): UseMicrophoneRecorderReturn => {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const [state, setState] = useState<RecorderState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [durationMs, setDurationMs] = useState(0);
  const [hasPermission, setHasPermission] = useState(false);
  const startTimeRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      stopTimer();
      mediaRecorderRef.current?.stream.getTracks().forEach((track) => track.stop());
      mediaRecorderRef.current = null;
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  const stopTimer = () => {
    if (timerRef.current) {
      cancelAnimationFrame(timerRef.current);
      timerRef.current = null;
    }
  };

  const updateTimer = () => {
    if (!startTimeRef.current) return;
    setDurationMs(performance.now() - startTimeRef.current);
    timerRef.current = requestAnimationFrame(updateTimer);
  };

  const start = useCallback(async () => {
    if (state === "recording") return;
    setError(null);

    try {
      if (!mediaRecorderRef.current) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setHasPermission(true);
        mediaRecorderRef.current = new MediaRecorder(stream, { mimeType, audioBitsPerSecond });
      }

      chunksRef.current = [];
      mediaRecorderRef.current!.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current!.onstop = () => {
        stopTimer();
        startTimeRef.current = null;
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        if (audioUrl) {
          URL.revokeObjectURL(audioUrl);
        }
        setAudioUrl(URL.createObjectURL(blob));
        setState("stopped");
      };

      mediaRecorderRef.current!.start();
      startTimeRef.current = performance.now();
      updateTimer();
      setDurationMs(0);
      setState("recording");
    } catch (err) {
      console.error("Microphone access failed", err);
      setError(err instanceof Error ? err.message : "Unable to access microphone");
      setState("error");
      setHasPermission(false);
    }
  }, [audioBitsPerSecond, mimeType, state]);

  const stop = useCallback(() => {
    if (mediaRecorderRef.current && state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }, [state]);

  const reset = useCallback(() => {
    stopTimer();
    setAudioBlob(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    setDurationMs(0);
    setState("idle");
    setError(null);
  }, [audioUrl]);

  const clearAudio = useCallback(() => {
    setAudioBlob(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
  }, [audioUrl]);

  return {
    state,
    error,
    start,
    stop,
    reset,
    audioBlob,
    audioUrl,
    clearAudio,
    durationMs,
    hasPermission,
  };
};
