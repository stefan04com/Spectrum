import { useCallback, useEffect, useMemo, useState } from "react";

type VoicePreference = {
  voiceName?: string;
  gender?: "female" | "male" | "neutral";
  language?: string;
};

type ResolvedPreference = {
  voiceName?: string;
  gender: "female" | "male" | "neutral";
  language: string;
};

const CALM_VOICE_HINTS = [
  "aria",
  "jenny",
  "zira",
  "serena",
  "samantha",
  "karen",
  "victoria",
  "joanna",
  "allison",
  "olivia",
  "emma",
  "sofia",
  "clara",
  "wave net",
  "neural",
  "female",
  "woman",
];

const normalize = (value?: string) => value?.toLowerCase().trim() ?? "";

export const useSpeechSynthesis = (preference?: VoicePreference) => {
  const resolvedPreference = useMemo<ResolvedPreference>(
    () => ({ gender: "female", language: "en", ...preference }),
    [preference],
  );
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceName, setSelectedVoiceName] = useState<string | null>(null);

  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      setVoices(availableVoices);
      if (!selectedVoiceName && availableVoices.length > 0) {
        const bestGuess = pickCalmVoice(availableVoices, resolvedPreference);
        setSelectedVoiceName(bestGuess?.name ?? null);
      }
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, [resolvedPreference, selectedVoiceName]);

  useEffect(() => {
    if (!selectedVoiceName && voices.length) {
      const bestGuess = pickCalmVoice(voices, resolvedPreference);
      if (bestGuess) {
        setSelectedVoiceName(bestGuess.name);
      }
    }
  }, [resolvedPreference, selectedVoiceName, voices]);

  const selectedVoice = useMemo(
    () => voices.find((voice) => voice.name === selectedVoiceName) ?? pickCalmVoice(voices, resolvedPreference),
    [resolvedPreference, selectedVoiceName, voices],
  );

  const speak = useCallback((text: string) => {
    if (!window.speechSynthesis) {
      console.error("Speech synthesis not supported");
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);

    const preferredVoice = selectedVoice ?? pickCalmVoice(voices, resolvedPreference);
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    // Calm, slow speech settings
    utterance.rate = 0.82;
    utterance.pitch = 0.95;
    utterance.volume = 0.95;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }, [resolvedPreference, selectedVoice, voices]);

  const stop = useCallback(() => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  const setVoiceByName = (name: string) => {
    const matchingVoice = voices.find((voice) => voice.name === name);
    if (matchingVoice) {
      setSelectedVoiceName(name);
    }
  };

  return {
    speak,
    stop,
    isSpeaking,
    voices,
    selectedVoice,
    setVoiceByName,
  };
};

function pickCalmVoice(availableVoices: SpeechSynthesisVoice[], preference: ResolvedPreference): SpeechSynthesisVoice | undefined {
  if (!availableVoices.length) return undefined;

  const preferredLanguage = normalize(preference.language ?? "en");
  const preferredName = normalize(preference.voiceName);
  const preferredGender = preference.gender ?? "female";

  const scored = availableVoices.map((voice) => ({ voice, score: scoreVoice(voice, preferredLanguage, preferredName, preferredGender) }));

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.voice;
}

function scoreVoice(
  voice: SpeechSynthesisVoice,
  preferredLanguage: string,
  preferredName: string,
  preferredGender: "female" | "male" | "neutral",
): number {
  let score = 0;
  const name = normalize(voice.name);
  const lang = normalize(voice.lang);

  if (preferredLanguage && lang.startsWith(preferredLanguage)) {
    score += 20;
  }

  if (preferredName && name.includes(preferredName)) {
    score += 50;
  }

  if (preferredGender === "female" && CALM_VOICE_HINTS.some((hint) => name.includes(hint))) {
    score += 30;
  }

  if (preferredGender === "male" && name.includes("male")) {
    score += 15;
  }

  if (voice.default) {
    score += 5;
  }

  if (voice.lang.toLowerCase().includes("en")) {
    score += 5;
  }

  return score;
}
