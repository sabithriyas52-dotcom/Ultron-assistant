export type TaskCategory = "personal" | "work";

export interface Task {
  id: string;
  title: string;
  category: TaskCategory;
  done: boolean;
  createdAt: number;
  dueAt?: number | null;
}

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
}
