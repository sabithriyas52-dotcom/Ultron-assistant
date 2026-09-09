"use client";

import { useCallback, useEffect, useState } from "react";
import type { Task, TaskCategory } from "./types";

const STORAGE_KEY = "ultron.tasks.v1";

function loadTasks(): Task[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveTasks(tasks: Task[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch {
    // storage unavailable (private mode, quota, etc.) — fail silently
  }
}

function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setTasks(loadTasks());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveTasks(tasks);
  }, [tasks, hydrated]);

  const addTask = useCallback(
    (title: string, category: TaskCategory, dueAt?: number | null) => {
      const trimmed = title.trim();
      if (!trimmed) return;
      setTasks((prev) => [
        {
          id: makeId(),
          title: trimmed,
          category,
          done: false,
          createdAt: Date.now(),
          dueAt: dueAt ?? null,
        },
        ...prev,
      ]);
    },
    [],
  );

  const toggleTask = useCallback((id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
    );
  }, []);

  const deleteTask = useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearDone = useCallback((category?: TaskCategory) => {
    setTasks((prev) =>
      prev.filter((t) => !(t.done && (!category || t.category === category))),
    );
  }, []);

  return { tasks, hydrated, addTask, toggleTask, deleteTask, clearDone };
}

export type UseTasksReturn = ReturnType<typeof useTasks>;
