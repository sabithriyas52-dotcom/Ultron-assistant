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

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-5";

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
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Missing ANTHROPIC_API_KEY on the server. Add it to .env.local and restart the dev server.",
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

  try {
    const response = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 600,
        system: buildSystemPrompt(tasks),
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json(
        { error: `Anthropic API error (${response.status}): ${errText}` },
        { status: 502 },
      );
    }

    const data = await response.json();
    const text = Array.isArray(data.content)
      ? data.content
          .filter((block: { type: string }) => block.type === "text")
          .map((block: { text: string }) => block.text)
          .join("\n")
      : "";

    return NextResponse.json({ reply: text || "…" });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error calling Anthropic API" },
      { status: 500 },
    );
  }
}
