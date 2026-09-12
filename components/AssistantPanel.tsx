"use client";

import { useEffect, useRef, useState } from "react";
import type { TaskCategory } from "@/lib/assistant/types";
import { useTasks } from "@/lib/assistant/taskStore";
import { useVoice } from "@/lib/assistant/useVoice";
import { useChat } from "@/lib/assistant/useChat";
import { GoogleConnectButton } from "@/components/GoogleConnectButton";

type Tab = "chat" | "tasks";

export default function AssistantPanel({
  open,
  onClose,
  onActivity,
  wakeCommand,
}: {
  open: boolean;
  onClose: () => void;
  onActivity: (level: number) => void;
  wakeCommand?: { token: number; text: string } | null;
}) {
  const [tab, setTab] = useState<Tab>("chat");
  const [input, setInput] = useState("");
  const [taskCategory, setTaskCategory] = useState<TaskCategory>("personal");
  const [taskFilter, setTaskFilter] = useState<TaskCategory>("personal");
  const logRef = useRef<HTMLDivElement>(null);

  const { tasks, addTask, toggleTask, deleteTask } = useTasks();

  const voice = useVoice({
    onFinalTranscript: (text) => {
      void sendMessage(text);
    },
  });

  const { messages, pending, error, sendMessage, addAssistantMessage } = useChat({
    getTasks: () => tasks,
    onReply: (text) => {
      if (voice.ttsSupported) voice.speak(text);
    },
  });

  useEffect(() => {
    if (voice.listening) onActivity(0.55);
    else if (pending) onActivity(0.4);
    else if (voice.speaking) onActivity(0.85);
    else onActivity(0);
  }, [voice.listening, voice.speaking, pending, onActivity]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  const greetedRef = useRef(false);
  useEffect(() => {
    if (open && !greetedRef.current) {
      greetedRef.current = true;
      if (!wakeCommand) {
        const greetings = [
          "What's up, boss?",
          "Ready when you are.",
          "Systems online. What do you need?",
          "Hey, good to see you.",
        ];
        const greeting = greetings[Math.floor(Math.random() * greetings.length)];
        addAssistantMessage(greeting);
      }
    } else if (!open) {
      greetedRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, addAssistantMessage]);

  const lastWakeTokenRef = useRef<number | null>(null);
  useEffect(() => {
    if (!wakeCommand || wakeCommand.token === lastWakeTokenRef.current) return;
    lastWakeTokenRef.current = wakeCommand.token;

    if (wakeCommand.text) {
      void sendMessage(wakeCommand.text);
    } else if (voice.supported && !voice.listening) {
      voice.startListening();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wakeCommand]);

  if (!open) return null;

  const submitText = () => {
    if (!input.trim()) return;
    void sendMessage(input);
    setInput("");
  };

  const filteredTasks = tasks.filter((t) => t.category === taskFilter);

  return (
    <div className="assistant-panel">
      <div className="assistant-header">
        <div className="assistant-tabs">
          <button
            type="button"
            className={`assistant-tab${tab === "chat" ? " active" : ""}`}
            onClick={() => setTab("chat")}
          >
            INFINI
          </button>
          <button
            type="button"
            className={`assistant-tab${tab === "tasks" ? " active" : ""}`}
            onClick={() => setTab("tasks")}
          >
            TASKS
          </button>
        </div>
        <GoogleConnectButton />
        <button type="button" className="assistant-close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>

      {tab === "chat" && (
        <div className="assistant-body">
          <div className="assistant-log" ref={logRef}>
            {messages.length === 0 && (
              <div className="assistant-empty">
                Ask me anything, or say &ldquo;add a task&rdquo; — I can hear you if you tap the mic.
              </div>
            )}
            {messages.map((m) => (
              <div key={m.id} className={`assistant-msg ${m.role}`}>
                <span className="assistant-msg-role">{m.role === "user" ? "YOU" : "INFINI"}</span>
                <span className="assistant-msg-text">{m.content}</span>
              </div>
            ))}
            {pending && (
              <div className="assistant-msg assistant">
                <span className="assistant-msg-role">INFINI</span>
                <span className="assistant-msg-text assistant-typing">thinking…</span>
              </div>
            )}
            {voice.interimText && (
              <div className="assistant-msg user">
                <span className="assistant-msg-role">YOU</span>
                <span className="assistant-msg-text assistant-typing">{voice.interimText}</span>
              </div>
            )}
          </div>

          {error && <div className="assistant-error">{error}</div>}

          <div className="assistant-input-row">
            {voice.supported && (
              <button
                type="button"
                className={`hud-btn assistant-mic${voice.listening ? " listening" : ""}`}
                onClick={() => (voice.listening ? voice.stopListening() : voice.startListening())}
                aria-pressed={voice.listening}
                aria-label="Toggle voice input"
              >
                {voice.listening ? "● LISTENING" : "MIC"}
              </button>
            )}
            <input
              className="assistant-text-input"
              placeholder="Type a message…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitText();
              }}
            />
            <button type="button" className="hud-btn" onClick={submitText} disabled={pending}>
              SEND
            </button>
          </div>
          {voice.speaking && (
            <button type="button" className="hud-btn assistant-stop-speak" onClick={voice.cancelSpeaking}>
              STOP SPEAKING
            </button>
          )}
        </div>
      )}

      {tab === "tasks" && (
        <div className="assistant-body">
          <div className="assistant-task-filter">
            <button
              type="button"
              className={`assistant-tab${taskFilter === "personal" ? " active" : ""}`}
              onClick={() => setTaskFilter("personal")}
            >
              PERSONAL
            </button>
            <button
              type="button"
              className={`assistant-tab${taskFilter === "work" ? " active" : ""}`}
              onClick={() => setTaskFilter("work")}
            >
              WORK
            </button>
          </div>

          <div className="assistant-task-list">
            {filteredTasks.length === 0 && (
              <div className="assistant-empty">No {taskFilter} tasks yet.</div>
            )}
            {filteredTasks.map((t) => (
              <div key={t.id} className={`assistant-task${t.done ? " done" : ""}`}>
                <button
                  type="button"
                  className="assistant-task-check"
                  onClick={() => toggleTask(t.id)}
                  aria-label={t.done ? "Mark as not done" : "Mark as done"}
                >
                  {t.done ? "✓" : ""}
                </button>
                <span className="assistant-task-title">{t.title}</span>
                <button
                  type="button"
                  className="assistant-task-delete"
                  onClick={() => deleteTask(t.id)}
                  aria-label="Delete task"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <div className="assistant-input-row">
            <select
              className="assistant-category-select"
              value={taskCategory}
              onChange={(e) => setTaskCategory(e.target.value as TaskCategory)}
            >
              <option value="personal">Personal</option>
              <option value="work">Work</option>
            </select>
            <input
              className="assistant-text-input"
              placeholder="New task…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && input.trim()) {
                  addTask(input, taskCategory);
                  setInput("");
                }
              }}
            />
            <button
              type="button"
              className="hud-btn"
              onClick={() => {
                if (input.trim()) {
                  addTask(input, taskCategory);
                  setInput("");
                }
              }}
            >
              ADD
            </button>
          </div>
        </div>
      )}
    </div>
  );
}