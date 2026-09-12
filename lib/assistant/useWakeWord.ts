"use client";

import { useEffect, useRef } from "react";

// Same minimal (non-standard, webkit-prefixed) SpeechRecognition typing
// used in useVoice.ts.
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  }
}

export interface UseWakeWordOptions {
  /** Whether the background listener should be running right now. */
  enabled: boolean;
  /** Word/phrase to listen for, case-insensitive. Defaults to "infini". */
  wakeWord?: string;
  /**
   * Called when the wake word is heard. `command` is any speech that
   * followed the wake word in the same utterance — empty if the user
   * just said the wake word on its own.
   */
  onWake: (command: string) => void;
}

/**
 * Runs a continuous, always-listening speech recognizer in the background.
 * Whenever it hears the wake word, it calls onWake() with anything spoken
 * right after it. Automatically restarts itself if the browser stops it
 * (which happens periodically even in "continuous" mode).
 */
export function useWakeWord({ enabled, wakeWord = "infini", onWake }: UseWakeWordOptions) {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const onWakeRef = useRef(onWake);
  onWakeRef.current = onWake;

  useEffect(() => {
    const Ctor =
      typeof window !== "undefined"
        ? window.SpeechRecognition ?? window.webkitSpeechRecognition
        : undefined;
    if (!Ctor || !enabled) return;

    let stopped = false;
    let restartTimer: ReturnType<typeof setTimeout> | null = null;

    const startOne = () => {
      if (stopped) return;
      const recognition = new Ctor();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = "en-US";

      recognition.onresult = (event: SpeechRecognitionEventLike) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (!result.isFinal) continue;
          const transcript = result[0].transcript;
          const lower = transcript.toLowerCase();
          const idx = lower.indexOf(wakeWord.toLowerCase());
          if (idx !== -1) {
            const command = transcript.slice(idx + wakeWord.length).trim();
            onWakeRef.current(command);
          }
        }
      };
      recognition.onerror = () => {
        // Swallow errors (e.g. "no-speech", "aborted") — onend below
        // handles restarting us either way.
      };
      recognition.onend = () => {
        recognitionRef.current = null;
        if (!stopped) {
          restartTimer = setTimeout(startOne, 300);
        }
      };

      recognitionRef.current = recognition;
      try {
        recognition.start();
      } catch {
        // start() throws if called while already running somewhere; ignore
        // and let the next restart attempt handle it.
      }
    };

    startOne();

    return () => {
      stopped = true;
      if (restartTimer) clearTimeout(restartTimer);
      recognitionRef.current?.stop();
      recognitionRef.current = null;
    };
  }, [enabled, wakeWord]);
}