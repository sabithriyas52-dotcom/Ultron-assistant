"use client";

import { useCallback, useRef, useState } from "react";
import type { ChatMessage, Task } from "./types";

function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export interface UseChatOptions {
  getTasks: () => Task[];
  onReply?: (text: string) => void;
}

export function useChat({ getTasks, onReply }: UseChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const historyRef = useRef<ChatMessage[]>([]);
  historyRef.current = messages;

  const sendMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed || pending) return;

      setError(null);
      const userMsg: ChatMessage = {
        id: makeId(),
        role: "user",
        content: trimmed,
        createdAt: Date.now(),
      };
      const nextHistory = [...historyRef.current, userMsg];
      setMessages(nextHistory);
      setPending(true);

      try {
        const tasks = getTasks();
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            messages: nextHistory.map((m) => ({ role: m.role, content: m.content })),
            tasks: tasks.map((t) => ({
              title: t.title,
              category: t.category,
              done: t.done,
            })),
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error ?? "Assistant request failed");
        }

        const replyText: string = data.reply ?? "";
        const assistantMsg: ChatMessage = {
          id: makeId(),
          role: "assistant",
          content: replyText,
          createdAt: Date.now(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        onReply?.(replyText);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setPending(false);
      }
    },
    [getTasks, onReply, pending],
  );

  const clearChat = useCallback(() => setMessages([]), []);

  return { messages, pending, error, sendMessage, clearChat };
}
