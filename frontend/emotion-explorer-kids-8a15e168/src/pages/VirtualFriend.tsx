import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Mic, Sparkles, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useMicrophoneRecorder } from "@/hooks/useMicrophoneRecorder";
import { buildBackendUrl } from "@/lib/api";

type BuddyRole = "friend" | "child";

type BuddyMessage = {
  id: number;
  role: BuddyRole;
  text: string;
  tone: "soft" | "child";
};

const buddyMessages: BuddyMessage[] = [
  {
    id: 1,
    role: "friend" as const,
    text: "Hey there! I’m here to listen. What’s on your mind?",
    tone: "soft",
  },
  {
    id: 2,
    role: "child" as const,
    text: "I felt a bit worried at school today.",
    tone: "child",
  },
  {
    id: 3,
    role: "friend" as const,
    text: "Thank you for telling me. Let’s breathe together and think of one safe place you love.",
    tone: "soft",
  },
];

const statusCopy: Record<ConversationStatus, { label: string; helper: string }> = {
  idle: { label: "Ready to listen", helper: "Tap the mic to begin a calm check-in." },
  listening: { label: "Listening", helper: "Share anything — your buddy hears every word." },
  thinking: { label: "Thinking", helper: "Your buddy is crafting a gentle response." },
  speaking: { label: "Speaking", helper: "Take a breath and listen to the soothing reply." },
};

type ConversationStatus = "idle" | "listening" | "thinking" | "speaking";

const VirtualFriend = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<BuddyMessage[]>(buddyMessages);
  const [uploadInfo, setUploadInfo] = useState<{ durationMs: number; sizeKb: number; mimeType: string } | null>(null);
  const [buddyThinking, setBuddyThinking] = useState(false);
  const [buddyError, setBuddyError] = useState<string | null>(null);
  const [lastBuddyNote, setLastBuddyNote] = useState<string | null>(null);
  const [lastTranscript, setLastTranscript] = useState<string | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const {
    state: recorderState,
    start,
    stop,
    reset,
    audioBlob,
    audioUrl,
    durationMs,
    hasPermission,
    error: recorderError,
  } = useMicrophoneRecorder({ mimeType: "audio/webm;codecs=opus" });

  const isRecording = recorderState === "recording";

  const conversationStatus: ConversationStatus = useMemo(() => {
    if (isRecording) return "listening";
    if (buddyThinking) return "thinking";
    if (lastBuddyNote) return "speaking";
    return "idle";
  }, [buddyThinking, isRecording, lastBuddyNote]);

  const statusMeta = statusCopy[conversationStatus];

  const playBuddyAudio = useCallback(async (arrayBuffer: ArrayBuffer) => {
    const audioCtx = audioCtxRef.current ?? new AudioContext();
    audioCtxRef.current = audioCtx;
    if (audioCtx.state === "suspended") {
      await audioCtx.resume();
    }

    const buffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    const gain = audioCtx.createGain();
    gain.gain.value = 1.5;
    source.connect(gain);
    gain.connect(audioCtx.destination);
    source.start(0);
  }, []);

  useEffect(() => {
    if (!audioBlob) return;

    let aborted = false;

    const processRecording = async () => {
      const seconds = Math.max(1, Number((durationMs / 1000).toFixed(1)));
      const placeholderId = Date.now();
      const placeholder: BuddyMessage = {
        id: placeholderId,
        role: "child",
        text: `Voice note ready (${seconds}s)… sending to Buddy Fox`,
        tone: "child",
      };
      setMessages((prev) => [...prev, placeholder]);

      setUploadInfo({
        durationMs: Math.round(durationMs),
        sizeKb: Math.max(1, Math.round(audioBlob.size / 1024)),
        mimeType: audioBlob.type,
      });

      setBuddyThinking(true);
      setBuddyError(null);
      setLastBuddyNote(null);
      setLastTranscript(null);

      try {
        const formData = new FormData();
        formData.append("audio", audioBlob, `voice-${placeholderId}.webm`);

        const response = await fetch(buildBackendUrl("/child/friend/talk"), {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`Buddy request failed: ${response.status}`);
        }

        const transcriptHeader = response.headers.get("X-Buddy-Transcript");
        const buddyHeader = response.headers.get("X-Buddy-Text");
        const transcript = transcriptHeader ? decodeURIComponent(transcriptHeader) : "I shared my feelings.";
        const buddyText = buddyHeader ? decodeURIComponent(buddyHeader) : "Thanks for trusting me.";
        const audioBuffer = await response.arrayBuffer();

        if (aborted) return;

        await playBuddyAudio(audioBuffer);

        setMessages((prev) => [
          ...prev,
          { id: placeholderId + 1, role: "child", text: transcript, tone: "child" },
          { id: placeholderId + 2, role: "friend", text: buddyText, tone: "soft" },
        ]);
        setLastTranscript(transcript);
        setLastBuddyNote(buddyText);
      } catch (error) {
        console.error("Buddy friend error", error);
        if (!aborted) {
          setBuddyError(error instanceof Error ? error.message : "Buddy friend failed");
        }
      } finally {
        if (!aborted) {
          setBuddyThinking(false);
          reset();
        }
      }
    };

    processRecording();

    return () => {
      aborted = true;
    };
  }, [audioBlob, durationMs, playBuddyAudio, reset]);

  const handleMicPress = async () => {
    if (isRecording) {
      stop();
      return;
    }
    try {
      await start();
    } catch (error) {
      console.error("Failed to start recording", error);
    }
  };

  const formattedDuration = useMemo(() =>
    durationMs > 0 ? `${(durationMs / 1000).toFixed(1)}s` : "0.0s",
  [durationMs]);

  useEffect(() => () => {
    audioCtxRef.current?.close();
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-sky-50 via-white to-emerald-50">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(124,226,255,0.3),_transparent_55%),radial-gradient(circle_at_bottom,_rgba(167,243,208,0.35),_transparent_50%)]" aria-hidden />
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10">
        <div className="flex items-center justify-between">
          <Button variant="ghost" className="rounded-2xl" onClick={() => navigate("/child")}> 
            <ArrowLeft className="mr-2 h-5 w-5" /> Back home
          </Button>
          <div className="hidden md:flex items-center gap-3 rounded-full bg-white/80 px-4 py-2 text-sm text-slate-600 shadow-sm">
            <Sparkles className="h-4 w-4 text-sky-400" />
            Calm buddy prototype
          </div>
        </div>

        <div className="space-y-3 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.6em] text-sky-600">Emotional Support</p>
          <h1 className="text-3xl font-black text-slate-900 sm:text-5xl">Virtual Friend</h1>
          <p className="text-base text-muted-foreground sm:text-lg">
            Whisper your feelings to your kind buddy. We’ll soon add live audio, gentle breathing, and personalized responses.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
          <section className="rounded-[32px] border border-primary/20 bg-white/80 p-6 shadow-xl shadow-primary/10">
            <div className="flex flex-col items-center text-center">
              <div className="relative mb-6 h-40 w-40 rounded-full bg-gradient-to-br from-sky-200 via-white to-emerald-100 shadow-inner">
                <div className="absolute inset-2 flex flex-col items-center justify-center rounded-full bg-white/70">
                  <span className="text-5xl" role="img" aria-label="Companion">🦊</span>
                  <p className="mt-2 text-sm font-semibold text-slate-600">Buddy Fox</p>
                </div>
              </div>
              <p className="text-sm text-slate-600">Soft animal guides who mirror feelings and model calming strategies.</p>

              <div className="mt-6 w-full rounded-2xl border border-slate-200 bg-white/70 p-4 text-left">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Status</p>
                <p className="text-lg font-bold text-slate-900">{statusMeta.label}</p>
                <p className="text-sm text-muted-foreground">{statusMeta.helper}</p>
                <div className="mt-3 rounded-xl bg-slate-100 px-3 py-2 text-xs text-slate-500">
                  <p>Recorder: {recorderState}</p>
                  <p>Duration: {formattedDuration}</p>
                  {!hasPermission && recorderState === "error" && <p>Grant mic permission to begin.</p>}
                  {audioUrl && (
                    <audio controls src={audioUrl} className="mt-2 w-full">
                      Your browser does not support the audio element.
                    </audio>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-4 rounded-[32px] border border-primary/10 bg-white/90 p-6 shadow-xl shadow-primary/10">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800">Conversation Preview</h2>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Volume2 className="h-4 w-4" /> Calm voice powered by OpenAI
              </div>
            </div>

            <div className="flex-1 space-y-4 overflow-hidden rounded-3xl bg-slate-50/80 p-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "max-w-[90%] rounded-2xl px-4 py-3 text-sm shadow",
                    message.role === "friend"
                      ? "ml-auto bg-sky-100 text-slate-800"
                      : "mr-auto bg-white text-slate-600",
                  )}
                >
                  {message.text}
                </div>
              ))}
              {buddyThinking ? (
                <p className="text-center text-xs text-amber-600">Buddy Fox is listening carefully…</p>
              ) : (
                <p className="text-center text-xs text-muted-foreground">Share a new voice note whenever you’re ready.</p>
              )}
            </div>

            <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white/80 p-4">
              <div className="flex items-center justify-between text-sm text-slate-500">
                <span>Microphone prototype</span>
                {isRecording && <span className="text-sky-500">Listening…</span>}
                {buddyThinking && <span className="text-amber-500">Thinking…</span>}
                {!isRecording && lastBuddyNote && !buddyThinking && <span className="text-emerald-500">Reply ready</span>}
              </div>
              <Button
                type="button"
                onClick={handleMicPress}
                disabled={recorderState === "waiting"}
                className={cn(
                  "mx-auto flex h-16 w-16 items-center justify-center rounded-full text-white shadow-lg transition-all",
                  isRecording && "animate-pulse bg-sky-400",
                  buddyThinking && !isRecording && "bg-amber-400",
                  !isRecording && lastBuddyNote && !buddyThinking && "bg-emerald-400",
                  !isRecording && !buddyThinking && !lastBuddyNote && "bg-slate-400",
                )}
              >
                {buddyThinking ? <Loader2 className="h-6 w-6 animate-spin" /> : <Mic className="h-6 w-6" />}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Tap once to record, tap again to stop. We’ll soon stream this clip to your AI fox friend.
              </p>
              {recorderError && <p className="text-center text-xs text-red-500">{recorderError}</p>}
              {buddyError && <p className="text-center text-xs text-red-500">{buddyError}</p>}
              {uploadInfo && (
                <div className="rounded-2xl border border-slate-200 bg-white/90 p-3 text-xs text-slate-500">
                  <p className="font-semibold text-slate-700">Payload preview</p>
                  <p>Duration: {(uploadInfo.durationMs / 1000).toFixed(1)}s</p>
                  <p>Size: {uploadInfo.sizeKb} KB</p>
                  <p>Type: {uploadInfo.mimeType}</p>
                  <p className="mt-1 text-[11px] text-slate-400">Sent to Buddy Fox for transcription + calm reply.</p>
                  {lastTranscript && (
                    <p className="mt-1 text-[11px] text-emerald-600">Transcript: {lastTranscript}</p>
                  )}
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white/70 p-4 text-center text-sm text-slate-500">
          Upcoming: real-time transcription, FOX buddy personality picker, and parent-approved memory cues.
        </div>
      </div>
    </div>
  );
};

export default VirtualFriend;
