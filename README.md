# ULTRON Orb UI

An Iron Man–inspired holographic orb built with **Next.js**, **Three.js**, and **MediaPipe** hand tracking — control it with your bare hands through your webcam.

> 🔮 This is the open-source **interface** of [ULTRON](https://sagartamang.com/projects/ultron) — my AI that talks in real time and controls Android devices by itself. **[Read the write-up](https://sagartamang.com/projects/ultron)** or **[the X post](https://x.com/sagar_builds/status/2077277583646101921)**

> 📱 **[Watch the demo on Instagram](https://www.instagram.com/p/DayJ17OTwvx/)**

![ULTRON orb UI](docs/screenshot.png)

https://github.com/user-attachments/assets/91578a83-9a27-44e8-84b0-96defcfd7366

## Getting started

```bash
npm install
cp .env.example .env.local   # then paste your Gemini API key in
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Get a **free** API key (no credit card required) at [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey). Without it, the orb still works fully — only the **ASSISTANT** panel's chat needs the key. The free tier has daily rate limits but is plenty for personal use; note Google may use free-tier prompts to improve their models, so avoid sending sensitive info through it.

## The assistant

Click **ASSISTANT** (top-right) or press `A` to open the panel. It has two tabs:

- **ASSISTANT** — a chat with Claude. Type, or tap **MIC** and just talk (uses your browser's built-in speech recognition). Replies are read aloud automatically via text-to-speech, and the orb glows brighter while it's listening/thinking/speaking.
- **TASKS** — a personal/work to-do list, saved locally in your browser (`localStorage`), so it persists across reloads on this device.

The assistant knows your current pending tasks (they're sent as context on every chat turn), so you can ask things like "what's still on my work list today?"

### Notes & next steps

- **Voice** uses the Web Speech API (`SpeechRecognition` + `speechSynthesis`) — no extra service required, but browser support varies (best in Chrome/Edge; limited in Firefox/Safari).
- **Calendar/email integration** isn't wired up yet — it needs your own Google Cloud OAuth credentials (Calendar/Gmail API). Happy to scaffold this next if you want it.
- **Device control** (controlling your phone/Android) isn't something a web app can do — that needs a separate native companion app, which is really its own project.

## Controls

### Mouse / touch

| Input | Action |
| --- | --- |
| Drag | Spin the orb |
| Scroll / pinch | Zoom in & out |

### Hand gestures (webcam)

Click **GESTURES OFF** (or press `G`) and allow camera access, then:

| Gesture | Action |
| --- | --- |
| Pinch (thumb + index) one hand and move it | Spin the orb |
| Pinch with **both** hands, spread apart / bring together | Zoom in / out |

### Keyboard

| Key | Action |
| --- | --- |
| `G` | Toggle hand gestures |
| `A` | Toggle the assistant panel |
| `R` | Reset the view |
| `+` / `−` | Zoom in / out |

## How it works

- **`lib/orbScene.ts`** — the Three.js scene: layered wireframe shells, a spiral
  inner core, floating code-text sprites, orbiting debris, dust particles, scan
  rings, and a bloom + chromatic-aberration post-processing stack. Exposes
  `setActivity(level)` so the bloom pulses brighter while the assistant is active.
- **`lib/handTracker.ts`** — MediaPipe HandLandmarker running on the webcam
  feed. Pinch detection with hysteresis: one pinched hand spins the orb, two
  pinched hands zoom by spreading apart or together.
- **`components/JarvisOrb.tsx`** — the HUD and glue between the scene, the
  tracker, and your inputs.
- **`components/AssistantPanel.tsx`** — the chat + task-list UI.
- **`lib/assistant/`** — the assistant's brain:
  - `useChat.ts` — message history + calls `/api/chat`.
  - `useVoice.ts` — mic input (speech-to-text) and spoken replies (text-to-speech).
  - `taskStore.ts` — personal/work task CRUD, persisted to `localStorage`.
  - `types.ts` — shared types.
- **`app/api/chat/route.ts`** — server route that calls the Google Gemini API with
  your `GEMINI_API_KEY`, keeping it off the client.

## License

MIT
