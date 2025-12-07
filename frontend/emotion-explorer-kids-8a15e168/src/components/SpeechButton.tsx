import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Volume2 } from "lucide-react";
import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis";
import { buildBackendUrl } from "@/lib/api";
import { cn } from "@/lib/utils";

interface SpeechButtonProps {
  text: string;
  label: string;
  icon?: React.ReactNode;
  className?: string;
  voice?: string;
  disableAiVoice?: boolean;
  spokenText?: string;
  childId?: string | number | null;
  analyticsKey?: string;
  analyticsCategory?: string;
}

const SpeechButton = ({
  text,
  label,
  icon,
  className = "",
  voice = "verse",
  disableAiVoice = false,
  spokenText,
  childId,
  analyticsKey,
  analyticsCategory,
}: SpeechButtonProps) => {
  const { speak, isSpeaking } = useSpeechSynthesis();
  const [isStreaming, setIsStreaming] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const script = spokenText ?? text;

  const resolvedChildId = useMemo(() => {
    if (childId === undefined || childId === null) {
      return null;
    }
    const numeric = typeof childId === "string" ? Number.parseInt(childId, 10) : Number(childId);
    return Number.isFinite(numeric) ? numeric : null;
  }, [childId]);

  const trackButtonUsage = useCallback(() => {
    if (!analyticsKey || resolvedChildId === null) {
      return;
    }

    const payload = {
      button_key: analyticsKey,
      label,
      category: analyticsCategory,
    };

    void fetch(buildBackendUrl(`/child/${resolvedChildId}/speech-button`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(error => {
      console.error("Failed to track speech button usage", error);
    });
  }, [analyticsKey, analyticsCategory, label, resolvedChildId]);

  useEffect(() => {
    return () => {
      sourceRef.current?.stop();
      sourceRef.current = null;
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
        audioCtxRef.current = null;
      }
    };
  }, []);

  const fallbackSpeak = () => {
    speak(script);
  };

  const handleClick = async () => {
    trackButtonUsage();

    if (disableAiVoice) {
      fallbackSpeak();
      return;
    }

    setIsStreaming(true);
    try {
      const response = await fetch(buildBackendUrl("/child/voice"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: script, voice }),
      });

      if (!response.ok) {
        throw new Error(`Voice request failed with status ${response.status}`);
      }

      const blob = await response.blob();
      await playWithGain(blob);
    } catch (error) {
      console.error("AI voice playback failed, falling back", error);
      fallbackSpeak();
    } finally {
      setIsStreaming(false);
    }
  };

  const playWithGain = async (blob: Blob) => {
    const arrayBuffer = await blob.arrayBuffer();
    const audioCtx = audioCtxRef.current ?? new AudioContext();
    audioCtxRef.current = audioCtx;
    if (audioCtx.state === "suspended") {
      await audioCtx.resume();
    }

    const buffer = await audioCtx.decodeAudioData(arrayBuffer);
    sourceRef.current?.stop();

    const source = audioCtx.createBufferSource();
    source.buffer = buffer;

    const gain = audioCtx.createGain();
    gain.gain.value = 1.5; // bump volume ~50%

    source.connect(gain);
    gain.connect(audioCtx.destination);
    source.start(0);
    sourceRef.current = source;
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isStreaming}
      aria-busy={isStreaming}
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-3xl border-2 border-border bg-card p-6",
        "transition-all duration-200 ease-in-out hover:border-primary hover:bg-accent",
        (isSpeaking || isStreaming) && "ring-4 ring-primary/50 scale-105",
        isStreaming && "opacity-80",
        className,
      )}
      aria-label={`Say: ${text}`}
    >
      <div className="text-4xl">
        {isStreaming ? <Loader2 className="h-10 w-10 animate-spin text-primary" /> : icon || <Volume2 className="w-10 h-10 text-primary" />}
      </div>
      <span className="text-lg font-medium text-foreground text-center">
        {label}
      </span>
    </button>
  );
};

export default SpeechButton;
