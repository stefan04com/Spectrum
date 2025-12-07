import { useCallback, useEffect, useMemo, useState, type DragEvent, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

interface RoutineStep {
  id: string;
  title: string;
  prompt: string;
  icon: string;
}

type RoutineType = "morning" | "bedtime" | "school" | "calming";

const ROUTINE_PRESETS: Record<RoutineType, RoutineStep[]> = {
  morning: [
    {
      id: "wake",
      title: "Rise and Shine",
      prompt: "Open your eyes, stretch tall, and smile to welcome the day.",
      icon: "🌅",
    },
    {
      id: "wash",
      title: "Splash & Brush",
      prompt: "Wash your face and brush your teeth with calm little circles.",
      icon: "🪥",
    },
    {
      id: "dress",
      title: "Cozy Outfit",
      prompt: "Pick comfy clothes and take a deep breath as you get dressed.",
      icon: "🧥",
    },
    {
      id: "breakfast",
      title: "Mindful Breakfast",
      prompt: "Sit tall, take small bites, and notice the flavors you enjoy.",
      icon: "🥣",
    },
    {
      id: "pack",
      title: "Ready Bag",
      prompt: "Place your favorite book and water bottle in your bag gently.",
      icon: "🎒",
    },
  ],
  bedtime: [
    {
      id: "tidy",
      title: "Tidy the Nest",
      prompt: "Place toys and books back in their cozy spots one by one.",
      icon: "🧸",
    },
    {
      id: "bathtime",
      title: "Warm Bath",
      prompt: "Let warm water hug you while you breathe slow bubbles.",
      icon: "🛁",
    },
    {
      id: "pajamas",
      title: "Soft Pajamas",
      prompt: "Slide into your comfiest pajamas and stretch like a cat.",
      icon: "🩵",
    },
    {
      id: "story",
      title: "Story Glow",
      prompt: "Snuggle up for a bedtime story and imagine the scenes.",
      icon: "📖",
    },
    {
      id: "lights",
      title: "Twinkle Lights",
      prompt: "Dim the lights, whisper goodnight, and breathe like waves.",
      icon: "🌙",
    },
  ],
  school: [
    {
      id: "checklist",
      title: "Morning Checklist",
      prompt: "Review today’s plan and circle three things you’re excited for.",
      icon: "📝",
    },
    {
      id: "snack",
      title: "Snack & Water",
      prompt: "Pack a crunchy snack and fill your water bottle calmly.",
      icon: "🥤",
    },
    {
      id: "supplies",
      title: "Supplies Ready",
      prompt: "Place homework, pencils, and notes neatly in your bag.",
      icon: "🎒",
    },
    {
      id: "shoes",
      title: "Shoes & Coat",
      prompt: "Tie your shoes slowly, then zip up your favorite coat.",
      icon: "🥾",
    },
    {
      id: "goodbye",
      title: "Goodbye Ritual",
      prompt: "Give a hug, high-five, or wave to start the day with joy.",
      icon: "👋",
    },
  ],
  calming: [
    {
      id: "breathe",
      title: "Rainbow Breaths",
      prompt: "Trace an imaginary rainbow while taking five deep breaths.",
      icon: "🌈",
    },
    {
      id: "stretch",
      title: "Gentle Stretch",
      prompt: "Reach up to the sky, then fold forward like a soft waterfall.",
      icon: "🧘",
    },
    {
      id: "sip",
      title: "Sip of Calm",
      prompt: "Drink a small sip of water and feel it cool your body.",
      icon: "💧",
    },
    {
      id: "affirm",
      title: "Kind Words",
      prompt: "Say a gentle phrase like ‘I am safe and steady.’",
      icon: "💛",
    },
    {
      id: "signal",
      title: "Ready Signal",
      prompt: "Press your hands together, smile, and feel grounded.",
      icon: "🫶",
    },
  ],
};

const ROUTINE_METADATA: Record<
  RoutineType,
  {
    label: string;
    headline: string;
    description: string;
    badge: string;
    icon: string;
  }
> = {
  morning: {
    label: "Morning Glow",
    headline: "Arrange the calm morning steps",
    description: "Tap to hear each card, then drag or tap again to place it where it belongs.",
    badge: "Sunrise focus",
    icon: "🌅",
  },
  bedtime: {
    label: "Bedtime Drift",
    headline: "Settle into a dreamy bedtime routine",
    description: "Swap each card until the evening flow feels soothing and steady.",
    badge: "Moonlit unwind",
    icon: "🌙",
  },
  school: {
    label: "School Launch",
    headline: "Prep for school with steady steps",
    description: "Line up backpacks, snacks, and goodbyes for a confident start.",
    badge: "Ready to roll",
    icon: "🎒",
  },
  calming: {
    label: "Calming Break",
    headline: "Create a peaceful regulation ritual",
    description: "Build a breathing-and-body routine to reset your nervous system.",
    badge: "Soft reset",
    icon: "💗",
  },
};

const ROUTINE_TYPE_ORDER: RoutineType[] = ["morning", "school", "bedtime", "calming"];

const shuffleSteps = (steps: RoutineStep[]) => {
  const next = [...steps];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
};

const isCorrectOrder = (current: RoutineStep[], target: RoutineStep[]) =>
  current.every((step, index) => step.id === target[index]?.id);

const useSuccessTone = () => {
  return useCallback(() => {
    if (typeof window === "undefined") return;
    const AudioContextRef = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextRef) return;

    const ctx = new AudioContextRef();
    const notes = [523.25, 659.25, 783.99];

    notes.forEach((frequency, index) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();

      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      oscillator.connect(gain);
      gain.connect(ctx.destination);

      const startTime = ctx.currentTime + index * 0.12;
      const endTime = startTime + 0.4;

      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.exponentialRampToValueAtTime(0.3, startTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, endTime);

      oscillator.start(startTime);
      oscillator.stop(endTime + 0.05);
    });
  }, []);
};

interface RoutineBuilderGameProps {
  routineType?: RoutineType;
  onSuccess?: () => void;
}

const RoutineBuilderGame = ({ routineType = "morning", onSuccess }: RoutineBuilderGameProps) => {
  const orderedSteps = useMemo(() => ROUTINE_PRESETS[routineType] ?? ROUTINE_PRESETS.morning, [routineType]);
  const routineMeta = ROUTINE_METADATA[routineType] ?? ROUTINE_METADATA.morning;

  const [cards, setCards] = useState<RoutineStep[]>(() => shuffleSteps(orderedSteps));
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [completed, setCompleted] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [completionRatio, setCompletionRatio] = useState(0);

  const { speak } = useSpeechSynthesis();
  const playSuccessTone = useSuccessTone();

  useEffect(() => {
    setCards(shuffleSteps(orderedSteps));
    setSelectedIndex(null);
    setDraggingIndex(null);
    setCompleted(false);
    setShowCelebration(false);
    setCompletionRatio(0);
  }, [orderedSteps]);

  const updateCompletionState = useCallback(
    (nextOrder: RoutineStep[]) => {
      const correctSteps = nextOrder.reduce(
        (count, step, index) => (step.id === orderedSteps[index]?.id ? count + 1 : count),
        0,
      );
      setCompletionRatio(correctSteps / orderedSteps.length);

      if (!completed && isCorrectOrder(nextOrder, orderedSteps)) {
        setCompleted(true);
        setShowCelebration(true);
        playSuccessTone();
        onSuccess?.();
      }
    },
    [completed, onSuccess, orderedSteps, playSuccessTone],
  );

  const swapCards = useCallback(
    (from: number, to: number) => {
      setCards((prev) => {
        const next = [...prev];
        [next[from], next[to]] = [next[to], next[from]];
        updateCompletionState(next);
        return next;
      });
    },
    [updateCompletionState],
  );

  const handleCardClick = (index: number) => {
    const step = cards[index];
    speak(step.prompt);

    if (completed) return;

    if (selectedIndex === null) {
      setSelectedIndex(index);
      return;
    }

    if (selectedIndex === index) {
      setSelectedIndex(null);
      return;
    }

    swapCards(selectedIndex, index);
    setSelectedIndex(null);
  };

  const handleDragStart = (event: DragEvent<HTMLButtonElement>, index: number) => {
    if (completed) return;
    event.dataTransfer.setData("text/plain", String(index));
    setDraggingIndex(index);
  };

  const handleDrop = (event: DragEvent<HTMLButtonElement>, index: number) => {
    if (completed) return;
    event.preventDefault();
    const from = Number(event.dataTransfer.getData("text/plain"));
    if (!Number.isNaN(from) && from !== index) {
      swapCards(from, index);
    }
    setDraggingIndex(null);
  };

  const handleDragOver = (event: DragEvent<HTMLButtonElement>) => {
    if (!completed) {
      event.preventDefault();
    }
  };

  const handleKeyboardSwap = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (completed) return;

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleCardClick(index);
    }

    if ((event.key === "ArrowUp" || event.key === "ArrowLeft") && index > 0) {
      event.preventDefault();
      swapCards(index, index - 1);
    }

    if ((event.key === "ArrowDown" || event.key === "ArrowRight") && index < cards.length - 1) {
      event.preventDefault();
      swapCards(index, index + 1);
    }
  };

  const handleReset = () => {
    setCards(shuffleSteps(orderedSteps));
    setSelectedIndex(null);
    setDraggingIndex(null);
    setCompleted(false);
    setShowCelebration(false);
    setCompletionRatio(0);
  };

  const progressLabel = useMemo(() => {
    if (completionRatio === 1) return "Everything is perfectly in order!";
    if (completionRatio >= 0.6) return "Almost there—keep the calm focus.";
    if (completionRatio >= 0.3) return "Nice flow—swap a few more cards.";
    return "Start by finding what comes first.";
  }, [completionRatio]);

  return (
    <div className="relative overflow-hidden rounded-[32px] border border-primary/10 bg-white/80 shadow-2xl shadow-primary/10 backdrop-blur">
      <div className="absolute inset-0 bg-gradient-to-br from-sky-50 via-transparent to-emerald-50 opacity-70" aria-hidden />
      <div className="relative z-10 flex flex-col gap-8 p-6 md:p-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.4em] text-sky-600">{routineMeta.badge}</p>
            <h2 className="text-2xl font-extrabold text-slate-900">{routineMeta.headline}</h2>
            <p className="text-sm text-muted-foreground">{routineMeta.description}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Progress</span>
                <span>{Math.round(completionRatio * 100)}%</span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sky-400 to-emerald-400 transition-all"
                  style={{ width: `${Math.round(completionRatio * 100)}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{progressLabel}</p>
            </div>
            <Button variant="outline" onClick={handleReset} className="rounded-2xl" aria-label="Shuffle the cards">
              <RefreshCw className="mr-2 h-4 w-4" />
              Shuffle
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {cards.map((step, index) => (
            <button
              key={step.id}
              type="button"
              draggable={!completed}
              onDragStart={(event) => handleDragStart(event, index)}
              onDragOver={handleDragOver}
              onDrop={(event) => handleDrop(event, index)}
              onClick={() => handleCardClick(index)}
              onKeyDown={(event) => handleKeyboardSwap(event, index)}
              className={cn(
                "group flex items-start gap-4 rounded-3xl border bg-white/70 p-5 text-left shadow-sm transition-all",
                "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200",
                completed ? "cursor-default" : "cursor-grab active:cursor-grabbing",
                selectedIndex === index && "border-sky-400 shadow-lg shadow-sky-100",
                draggingIndex === index && !completed && "scale-[1.01] border-sky-300 shadow-lg",
              )}
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-50 text-3xl shadow-inner">
                <span aria-hidden>{step.icon}</span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Step {index + 1}</span>
                  {orderedSteps[index]?.id === step.id && <span className="text-xs text-emerald-500">✓ in place</span>}
                </div>
                <h3 className="text-lg font-semibold text-slate-900">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.prompt}</p>
                <p className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-sky-600">
                  <Sparkles className="h-3.5 w-3.5" /> Tap to hear this step
                </p>
              </div>
            </button>
          ))}
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Tip: Tap one card and then another to swap them. Drag and drop also works if that feels easier!
        </p>

        {showCelebration && (
          <div className="flex flex-col items-center gap-2 rounded-3xl border border-emerald-200 bg-emerald-50/80 p-6 text-center text-emerald-600 shadow-inner transition-all">
            <CheckCircle2 className="h-12 w-12 animate-bounce" />
            <p className="text-xl font-semibold">Beautiful routine! Take a calm breath and celebrate your flow. 🌈</p>
          </div>
        )}
      </div>
    </div>
  );
};

const RoutineBuilderPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [routineType, setRoutineType] = useState<RoutineType>("morning");

  const handleSuccess = useCallback(() => {
    const meta = ROUTINE_METADATA[routineType] ?? ROUTINE_METADATA.morning;
    toast({
      title: `${meta.label} complete!`,
      description: "Everything is perfectly lined up. Amazing focus!",
      duration: 4000,
    });
  }, [routineType, toast]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#eaf7ff]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(146,205,255,0.35),_transparent_55%),radial-gradient(circle_at_20%_20%,_rgba(167,243,208,0.45),_transparent_45%)]" aria-hidden />
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10">
        <div className="flex items-center justify-between">
          <Button variant="ghost" className="rounded-2xl" onClick={() => navigate("/child/games")}>
            <ArrowLeft className="mr-2 h-5 w-5" /> Back to games
          </Button>
          <div className="hidden md:flex items-center gap-2 rounded-full bg-white/70 px-4 py-2 text-sm text-slate-600 shadow">
            <Sparkles className="h-4 w-4 text-sky-400" />
            Calm focus mode
          </div>
        </div>

        <div className="space-y-2 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.6em] text-sky-600">Mini game</p>
          <h1 className="text-3xl font-black text-slate-900 sm:text-5xl">Routine Builder</h1>
          <p className="text-base text-muted-foreground sm:text-lg">
            Arrange each step in the order that feels just right. Listen to the friendly voice and follow the soothing glow.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 rounded-3xl border border-sky-100 bg-white/70 p-4 shadow-sm">
          {ROUTINE_TYPE_ORDER.map((type) => {
            const option = ROUTINE_METADATA[type];
            const isActive = routineType === type;
            return (
              <button
                key={type}
                type="button"
                onClick={() => setRoutineType(type)}
                className={cn(
                  "flex min-w-[140px] flex-1 items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all",
                  "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200",
                  isActive
                    ? "border-sky-400 bg-sky-50 text-slate-900 shadow"
                    : "border-transparent bg-transparent text-slate-500 hover:border-slate-200",
                )}
                aria-pressed={isActive}
              >
                <span className="text-2xl" aria-hidden>
                  {option.icon}
                </span>
                <div>
                  <p className="text-sm font-semibold">{option.label}</p>
                  <p className="text-xs text-muted-foreground">{option.badge}</p>
                </div>
              </button>
            );
          })}
        </div>

        <RoutineBuilderGame routineType={routineType} onSuccess={handleSuccess} />
      </div>
    </div>
  );
};

export default RoutineBuilderPage;
