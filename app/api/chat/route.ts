import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

interface IncomingMessage {
  role: "user" | "assistant";
  content: string;
}

interface IncomingTask {
  title: string;
  category: "personal" | "work";
  done: boolean;
}

// Gemini's free tier (via Google AI Studio) is used here — no billing required
// to get started. See https://aistudio.google.com/app/apikey to grab a key.
const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent";

function buildSystemPrompt(tasks: IncomingTask[]): string {
  const pending = tasks.filter((t) => !t.done);
  const personal = pending.filter((t) => t.category === "personal");
  const work = pending.filter((t) => t.category === "work");

  const list = (items: IncomingTask[]) =>
    items.length ? items.map((t) => `- ${t.title}`).join("\n") : "(none)";

  return [
    "You are ULTRON, a personal AI assistant embedded in a holographic orb interface.",
    "You help the user manage both personal and work tasks, and answer general questions.",
    "Keep spoken replies short and natural (1-3 sentences) since they are read aloud with text-to-speech, unless the user clearly asks for something longer or more detailed (like a list, explanation, or written content).",
    "Do not use markdown formatting in your replies — plain spoken sentences only.",
    "",
    "Current pending PERSONAL tasks:",
    list(personal),
    "",
    "Current pending WORK tasks:",
    list(work),
    "",
    "If the user asks you to add, complete, or remove a task, respond conversationally confirming it — the app handles the actual task list separately based on the user's own actions in the UI, so just acknowledge naturally.",
  ].join("\n");
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Missing GEMINI_API_KEY on the server. Add it to .env.local and restart the dev server.",
      },
      { status: 500 },
    );
  }

  let body: { messages?: IncomingMessage[]; tasks?: IncomingTask[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  const tasks = Array.isArray(body.tasks) ? body.tasks : [];

  if (messages.length === 0) {
    return NextResponse.json({ error: "No messages provided" }, { status: 400 });
  }

  // Gemini uses "user" / "model" roles (not "assistant"), and takes the
  // system prompt as a separate top-level field rather than a message.
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  try {
    const response = await fetch(`${GEMINI_URL}?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: buildSystemPrompt(tasks) }] },
        contents,
        generationConfig: { maxOutputTokens: 600 },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json(
        { error: `Gemini API error (${response.status}): ${errText}` },
        { status: 502 },
      );
    }

    const data = await response.json();
    const parts = data?.candidates?.[0]?.content?.parts;
    const text = Array.isArray(parts)
      ? parts.map((p: { text?: string }) => p.text ?? "").join("\n")
      : "";

    return NextResponse.json({ reply: text || "…" });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error calling Gemini API" },
      { status: 500 },
    );
  }
}
