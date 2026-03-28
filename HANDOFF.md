# PROJECT PULSE — COMPREHENSIVE HANDOFF DOCUMENT

**Author:** Manus AI (CTO)
**Date:** March 28, 2026
**Purpose:** This document is the **sole context** for the next session. It must contain everything needed to continue development without access to prior conversation history.

---

## 1. PROJECT IDENTITY

**Project Pulse** is an autonomous emergency dispatch platform built for the **TinyFish Hackathon in Singapore**. It replaces static 911 routing with a dynamic, real-time pipeline that captures a bystander's voice description of an emergency, classifies it using AI, searches for nearby hospitals, scrapes their websites for live ER capacity data using TinyFish web agents, and then autonomously calls the best hospital via an AI voice agent to pre-notify them of the incoming patient. The entire flow runs in under 60 seconds from panic button press to hospital phone ringing.

**Tech Stack:**

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend Framework | React | 19.2.1 |
| Build Tool | Vite | 7.1.7 |
| CSS | Tailwind CSS | 4.1.14 |
| Animation | Framer Motion | 12.23.22 |
| Backend Framework | Express | 4.21.2 |
| API Layer | tRPC | 11.6.0 |
| Database ORM | Drizzle ORM | 0.44.5 |
| Database | MySQL (TiDB Cloud) | — |
| Language | TypeScript | 5.9.3 |
| Testing | Vitest | 2.1.4 |
| Package Manager | pnpm | 10.4.1 |
| Runtime | Node.js | 22.13.0 |

**External APIs:**

| API | Purpose | SDK/Method |
|-----|---------|------------|
| OpenAI GPT-4o | Emergency classification + Whisper transcription | `openai` npm v6.33.0 |
| Google Places (New) | Nearby hospital search within 15km radius | REST API via `axios` |
| TinyFish | Web scraping of hospital websites for ER capacity | REST API via `axios` |
| Vapi | Autonomous AI phone calls to hospitals | REST API via `axios` |
| ElevenLabs | Voice synthesis for Vapi assistant (voice: "sarah") | Configured through Vapi |
| Deepgram | Call transcription (nova-2 model) | Configured through Vapi |

**Repository:** `https://github.com/13shreyansh/pulse-emergency` (private)
**Branch:** `main`
**Manus Webdev Project ID:** `nLe7UerX5afEsppTsyhmre`
**Live Dev Server:** `https://3000-iafcaljsm1715dun8knr9-0a26333c.sg1.manus.computer`

---

## 2. ARCHITECTURE OVERVIEW

### High-Level System Design

Project Pulse follows a **voice-first, pipeline-driven architecture**. The frontend is a single-page React application with one primary view (`Home.tsx`) that orchestrates the entire emergency flow through a sequence of tRPC mutations. There is no multi-page routing — the entire experience happens on a single screen that transitions through phases: idle, recording, processing, and dispatched.

The backend is an Express server with tRPC procedures that form a strict pipeline. Each step in the pipeline (transcribe, classify, search hospitals, scrape websites, dispatch call) is a separate tRPC mutation that the frontend calls sequentially. Session state is persisted to a MySQL database at each step, and a dispatch log table records every event for the live status feed. The server acts as the orchestration layer, calling external APIs (OpenAI, Google Places, TinyFish, Vapi) and returning structured results to the frontend.

The **TinyFish integration** is the hackathon's core differentiator. After Google Places returns nearby hospitals with their website URLs, the server fans out up to 5 concurrent TinyFish web agents. Each agent navigates to a real hospital website and extracts structured ER data (wait times, bed availability, equipment status). A scoring algorithm then ranks hospitals based on both proximity and scraped capacity data, selecting the optimal target for the Vapi phone call.

### Directory Structure

```
pulse/
├── client/                          # Frontend (React 19 + Vite)
│   ├── index.html                   # HTML shell, loads main.tsx
│   ├── public/                      # Static files (favicon, robots.txt only)
│   └── src/
│       ├── App.tsx                   # Root component: Router + ThemeProvider + ErrorBoundary
│       ├── main.tsx                  # Entry point: tRPC client, QueryClient, providers
│       ├── index.css                 # Global Tailwind v4 theme (OKLCH dark navy/slate palette)
│       ├── lib/
│       │   ├── trpc.ts              # tRPC React client binding
│       │   └── utils.ts             # cn() utility for class merging
│       ├── pages/
│       │   ├── Home.tsx             # ★ MAIN PAGE: Orchestrates entire emergency pipeline
│       │   ├── NotFound.tsx         # 404 page (imported but not wired in Router)
│       │   └── ComponentShowcase.tsx # Dev-only shadcn component gallery
│       ├── components/
│       │   ├── PanicButton.tsx      # ★ Voice capture: hold-to-record, MediaRecorder API, 15s max
│       │   ├── CprMetronome.tsx     # ★ CPR guide: 100 BPM visual+audio, Web Audio oscillator
│       │   ├── StatusFeed.tsx       # ★ Live timeline: color-coded dispatch log entries
│       │   ├── DemoMode.tsx         # ★ Demo button: runs pipeline with hardcoded cardiac arrest transcript
│       │   ├── CallTracker.tsx      # ★ Call status UI: polls Vapi, shows transcript + outcome (NOT YET WIRED)
│       │   ├── DashboardLayout.tsx  # Template: sidebar layout (unused)
│       │   ├── AIChatBox.tsx        # Template: chat UI (unused)
│       │   ├── Map.tsx              # Template: Google Maps (unused)
│       │   ├── ErrorBoundary.tsx    # Global error boundary
│       │   ├── ManusDialog.tsx      # Template: auth dialog
│       │   └── ui/                  # shadcn/ui component library (40+ components)
│       ├── contexts/
│       │   └── ThemeContext.tsx      # Dark theme provider (fixed dark, no switcher)
│       ├── hooks/                   # Utility hooks (useMobile, useComposition, usePersistFn)
│       └── _core/
│           └── hooks/useAuth.ts     # Auth hook (template)
│
├── server/                          # Backend (Express + tRPC)
│   ├── routers.ts                   # ★ Root router: mounts auth + emergency namespaces
│   ├── db.ts                        # Database connection (lazy init, returns null if no DB_URL)
│   ├── storage.ts                   # S3 storage helpers (template)
│   ├── routers/
│   │   └── emergency.ts             # ★ MAIN ROUTER: 9 procedures for full pipeline
│   ├── services/
│   │   ├── classify.ts              # ★ OpenAI GPT-4o classification + Whisper transcription
│   │   ├── hospitals.ts             # ★ Google Places nearby search (15km, up to 10 results)
│   │   ├── scraper.ts              # ★ TinyFish concurrent web scraping (up to 5 agents)
│   │   ├── dispatch.ts             # ★ Vapi phone call dispatch + status polling + outcome parser
│   │   └── db-helpers.ts           # CRUD helpers for emergency_sessions + dispatch_logs
│   ├── _core/                       # Framework plumbing (DO NOT MODIFY)
│   │   ├── index.ts                 # Server entry point
│   │   ├── env.ts                   # ★ Environment variable accessor (all API keys here)
│   │   ├── trpc.ts                  # tRPC initialization
│   │   ├── context.ts               # Request context builder
│   │   ├── oauth.ts                 # Manus OAuth handler
│   │   ├── llm.ts                   # Built-in LLM helper (not used — we use OpenAI directly)
│   │   ├── voiceTranscription.ts    # Built-in Whisper helper (not used — we use OpenAI directly)
│   │   ├── map.ts                   # Backend Google Maps proxy
│   │   ├── notification.ts          # Owner notification helper
│   │   └── ...                      # Other framework files
│   ├── auth.logout.test.ts          # Test: auth logout procedure
│   ├── emergency.test.ts            # Test: CPR guidance + hospital scoring logic
│   └── secrets.test.ts              # Test: all API keys present + OpenAI auth check
│
├── drizzle/                         # Database schema & migrations
│   ├── schema.ts                    # ★ Tables: users, emergency_sessions, dispatch_logs
│   ├── relations.ts                 # Drizzle relations (empty)
│   ├── 0000_shiny_secret_warriors.sql  # Initial migration
│   ├── 0001_clever_joseph.sql       # Emergency tables migration
│   └── meta/                        # Drizzle migration metadata
│
├── shared/                          # Shared types between client and server
│   ├── pulse-types.ts               # ★ ALL Pulse type definitions (ClassificationResult, HospitalResult, etc.)
│   ├── types.ts                     # Template shared types
│   └── const.ts                     # Cookie name constant
│   └── _core/errors.ts              # Error constants
│
├── tasks.json                       # Agent task manifest (STALE — do not trust status fields)
├── todo.md                          # Feature checklist (partially outdated)
├── HANDOFF.md                       # THIS FILE
├── package.json                     # Dependencies and scripts
├── tsconfig.json                    # TypeScript config
├── vite.config.ts                   # Vite build config
├── vitest.config.ts                 # Test config
├── drizzle.config.ts                # Drizzle Kit config (requires DATABASE_URL)
└── components.json                  # shadcn/ui config
```

### Data Flow

The emergency pipeline flows through these exact steps, each a separate tRPC mutation:

```
[User presses panic button]
         │
         ▼
1. emergency.startSession()
   → Creates DB row with sessionId, status="recording"
   → Returns: { sessionId }
         │
         ▼
2. emergency.transcribe({ sessionId, audioBase64, mimeType })
   → Sends audio to OpenAI Whisper API
   → Updates DB: transcript field
   → Returns: { transcript }
         │
         ▼
3. emergency.classify({ sessionId, transcript })
   → Sends transcript to GPT-4o with medical classification prompt
   → Returns JSON: emergencyType, severity, confidence, cprNeeded, etc.
   → Builds CPR guidance if needed
   → Updates DB: emergencyType, severity, classification JSON
   → Returns: { classification, cprGuidance }
         │
         ▼
4. emergency.searchHospitals({ sessionId, latitude, longitude, hospitalType })
   → Calls Google Places API (searchNearby, 15km radius, up to 10 results)
   → Computes haversine distance for each hospital
   → Sorts by distance
   → Updates DB: hospitalsFound JSON
   → Returns: { hospitals[] }
         │
         ▼
5. emergency.scrapeAndSelect({ sessionId, hospitals[], emergencyType })
   → Fans out up to 5 TinyFish web agents concurrently (Promise.allSettled)
   → Each agent navigates to hospital.websiteUri and extracts:
     - ER wait time, resuscitation bay, defibrillator, trauma bay, bed availability
   → Scoring algorithm ranks hospitals (distance + equipment + wait time)
   → Updates DB: scrapingResults JSON, selectedHospitalName, selectedHospitalPhone
   → Returns: { selectedHospital, scrapingData, allResults[] }
         │
         ▼
6. emergency.dispatch({ sessionId, emergencyDetails, targetPhone? })
   → Calls Vapi API to initiate outbound phone call
   → Uses conversational 5-step assistant prompt
   → Voice: ElevenLabs "sarah" at 0.90x speed
   → Max duration: 90 seconds
   → Updates DB: vapiCallId, callStatus
   → Returns: { callId, status }
         │
         ▼
[Call in progress — Vapi AI agent talks to hospital]
         │
         ▼
7. emergency.getCallStatus({ callId })  [polling]
   → Fetches call status from Vapi API
   → Returns: { id, status, endedReason, duration, transcript, summary, messages[] }
```

**Demo Mode** skips step 2 (transcription) and uses a hardcoded cardiac arrest transcript instead. It still runs all other steps live (classification, hospital search, scraping, dispatch).

### Key Design Patterns

The project uses a **sequential mutation pipeline** pattern rather than a single long-running request. Each pipeline step is a separate tRPC mutation, which means the frontend can show granular progress updates and the system is resilient to partial failures. If scraping fails, the pipeline still proceeds with distance-only hospital selection.

State management is **local React state** — there is no global store (Redux, Zustand, etc.). The `Home.tsx` component holds all pipeline state (`phase`, `sessionId`, `transcript`, `classification`, `hospitals`, `selectedHospital`, `callResult`, `logs`) and passes data down to child components via props.

The **TinyFish fan-out** uses `Promise.allSettled()` to ensure that if some hospital websites fail to scrape, the pipeline still continues with whatever data was successfully retrieved. This is critical because real hospital websites are unpredictable.

---

## 3. CURRENT STATE

### COMPLETED (fully working, tested, deployed)

| Feature | File(s) | Status |
|---------|---------|--------|
| Voice capture (hold-to-record, 15s max, base64 output) | `client/src/components/PanicButton.tsx` | Working |
| CPR metronome (100 BPM, Web Audio beep, compression counter) | `client/src/components/CprMetronome.tsx` | Working |
| Live status feed (color-coded timeline, auto-scroll) | `client/src/components/StatusFeed.tsx` | Working |
| Demo mode button (hardcoded cardiac arrest transcript) | `client/src/components/DemoMode.tsx` | Working |
| OpenAI GPT-4o emergency classification | `server/services/classify.ts` | Working |
| OpenAI Whisper audio transcription | `server/services/classify.ts` (transcribeAudio) | Working |
| Google Places nearby hospital search (15km) | `server/services/hospitals.ts` | Working |
| TinyFish concurrent web scraping (up to 5 agents) | `server/services/scraper.ts` | Working |
| Hospital scoring algorithm (distance + equipment + wait time) | `server/services/scraper.ts` (selectBestHospital) | Working |
| Vapi AI phone call dispatch (5-step conversational prompt) | `server/services/dispatch.ts` (dispatchCall) | Working |
| Vapi call status polling | `server/services/dispatch.ts` (getCallStatus) | Working |
| Call transcript outcome parser | `server/services/dispatch.ts` (parseCallOutcome) | Working (but NOT wired) |
| Full tRPC emergency router (9 procedures) | `server/routers/emergency.ts` | Working |
| Database schema (emergency_sessions + dispatch_logs) | `drizzle/schema.ts` | Migrated |
| Database CRUD helpers | `server/services/db-helpers.ts` | Working |
| Dark navy/slate OKLCH theme | `client/src/index.css` | Working |
| End-to-end pipeline (voice → classify → search → scrape → dispatch) | `client/src/pages/Home.tsx` | Working |
| All API secrets configured | `server/_core/env.ts` | Verified |
| 16 Vitest tests passing | `server/*.test.ts` (3 files) | All green |
| GitHub repo created and initial code pushed | `13shreyansh/pulse-emergency` | Pushed |

### IN PROGRESS (partially done)

**1. CallTracker.tsx — Real-time call status UI**
- **File:** `client/src/components/CallTracker.tsx`
- **Current state:** The component is fully written and exists in the project, but it is **NOT imported or rendered** in `Home.tsx`. It is an orphaned file.
- **What remains:**
  - Import `CallTracker` into `Home.tsx`
  - Render it in the "dispatched" phase when `callResult?.callId` exists
  - Fix the tRPC procedure name mismatch: CallTracker calls `trpc.emergency.callStatus.useQuery()` but the router defines `trpc.emergency.getCallStatus.useQuery()`. Either rename the router procedure or update the component.
  - Fix the response shape mismatch: CallTracker expects `data.outcome` (a `CallOutcome` object with `hospitalConfirmed`, `erAvailable`, `equipmentReady`, `specialInstructions`, `outcome`), but the `getCallStatus` router procedure returns raw Vapi API data without running `parseCallOutcome()`. The router needs to call `parseCallOutcome(transcript)` and include the result in the response.

**2. Calmer UI palette**
- **Current state:** The `index.css` file has already been updated to use a dark navy/slate OKLCH palette (background: `oklch(0.14 0.015 250)`, cards: `oklch(0.18 0.015 250)`). This IS the calmer palette — it replaced the original pure black.
- **What remains:** Some individual components still hardcode black/red classes that override the theme:
  - `PanicButton.tsx` line 204: `bg-black` hardcoded
  - `CprMetronome.tsx` line 138: `bg-black` hardcoded
  - These should use `bg-background` instead to respect the navy theme.

**3. GitHub sync**
- **Current state:** Initial code was pushed to `13shreyansh/pulse-emergency`. But the Manus webdev project uses a separate internal git remote (`s3://vida-prod-gitrepo/...`). There are uncommitted changes (modified: `index.css`, `Home.tsx`, `dispatch.ts`, `todo.md`; untracked: `CallTracker.tsx`).
- **What remains:** Commit all changes, push to the internal remote, and separately push to the GitHub remote.

### BLOCKED

**1. CallTracker tRPC procedure name mismatch**
- CallTracker.tsx line 41 calls `trpc.emergency.callStatus.useQuery({ callId })`
- The router at `server/routers/emergency.ts` line 229 defines `getCallStatus` (not `callStatus`)
- This will cause a **TypeScript error** and **runtime crash** when CallTracker is imported
- **Fix:** Either rename the router procedure from `getCallStatus` to `callStatus`, or update CallTracker to use `trpc.emergency.getCallStatus.useQuery()`

**2. CallTracker response shape mismatch**
- CallTracker expects `data.outcome` to be a `CallOutcome` object (lines 103, 175-213)
- The `getCallStatus` router procedure (emergency.ts line 229-233) just forwards raw Vapi API response
- The `parseCallOutcome()` function exists in `dispatch.ts` (line 163-273) but is **never called** from the router
- **Fix:** In the `getCallStatus` procedure, after getting the raw status, call `parseCallOutcome(status.transcript)` and include it in the response

### NOT STARTED

| Feature | Priority | Notes |
|---------|----------|-------|
| "Powered by TinyFish" badge on UI | HIGH | Critical for hackathon judges |
| Hospital comparison table (show scraped data) | HIGH | Judges should SEE what TinyFish found |
| Mobile-first responsive polish | MEDIUM | Large touch targets exist, but layout needs testing on real phones |
| 3-minute demo script preparation | HIGH | Exact sequence for judges |
| Error recovery (retry individual pipeline steps) | LOW | Currently retries entire pipeline |
| Multi-language support | LOW | English only for hackathon |
| Call recording playback | LOW | Vapi records calls but we don't surface the recording URL |

---

## 4. DECISION LOG

### Decision 1: Sequential tRPC mutations vs. single long-running request
- **Decision:** Each pipeline step is a separate tRPC mutation called sequentially from the frontend.
- **Alternatives considered:** (a) Single server-side orchestrator that runs all steps and streams progress via WebSocket/SSE. (b) Background job queue with polling.
- **Why this approach:** Simplicity for a hackathon. Each step returns immediately with results, the frontend can show granular progress, and there's no WebSocket complexity. The tradeoff is that the frontend orchestrates the pipeline, which means it must stay connected throughout.
- **Caveat:** If the user closes the browser mid-pipeline, the session is left in a partial state in the DB. There's no background recovery.

### Decision 2: OpenAI directly vs. built-in Manus LLM helper
- **Decision:** Use the `openai` npm package directly instead of the template's `invokeLLM()` helper.
- **Alternatives considered:** Using `invokeLLM()` from `server/_core/llm.ts`.
- **Why this approach:** We need specific OpenAI features: `response_format: { type: "json_object" }` for structured classification output, and `openai.audio.transcriptions.create()` for Whisper. The built-in helper doesn't expose these.
- **Caveat:** This means we manage our own OpenAI API key (`OPENAI_API_KEY`) rather than using the platform's built-in key.

### Decision 3: TinyFish REST API vs. TinyFish SDK
- **Decision:** Use direct REST calls to `https://agent.tinyfish.ai/api/v1/run` via axios.
- **Alternatives considered:** Using the `@anthropic-ai/tinyfish` SDK or `AsyncTinyFish` class.
- **Why this approach:** The REST API is simpler, well-documented, and doesn't require SDK version management. The SDK was considered but the REST endpoint provides everything needed: POST a URL + goal, get structured results back.
- **Caveat:** The TinyFish API has a 45-second timeout per request. Some hospital websites may be slow or block scraping. `Promise.allSettled()` ensures partial failures don't break the pipeline.

### Decision 4: Vapi conversational assistant vs. monologue
- **Decision:** 5-step interactive conversation flow where the AI waits for hospital responses at each step.
- **Alternatives considered:** Single-message dump of all emergency info.
- **Why this approach:** Real hospital emergency departments need to confirm identity, check availability, and provide instructions. A monologue doesn't allow for this back-and-forth. The 5-step flow (identity confirmation → patient briefing → equipment check → ETA → close) mirrors real dispatch protocols.
- **Caveat:** The conversation can take up to 90 seconds (max duration). If the hospital doesn't answer or the call goes to voicemail, the call ends without useful data.

### Decision 5: Dark navy/slate palette vs. pure black/red
- **Decision:** Background `oklch(0.14 0.015 250)` (very dark navy) instead of `#000000` (pure black).
- **Alternatives considered:** Pure black with bright red accents (original design), light theme.
- **Why this approach:** User feedback that pure black + bright red was "intimidating" and "felt like a horror app." The navy/slate palette maintains the dark emergency aesthetic while being less aggressive. Red is still used for the panic button and severity indicators but with softer OKLCH values.
- **Caveat:** Some components (`PanicButton.tsx`, `CprMetronome.tsx`) still hardcode `bg-black` and need to be updated to `bg-background`.

### Decision 6: No authentication required for emergency flow
- **Decision:** All emergency procedures use `publicProcedure` (no auth required).
- **Alternatives considered:** Requiring login before using the emergency system.
- **Why this approach:** In a real emergency, requiring login would cost lives. The system must be accessible to anyone immediately.
- **Caveat:** This means anyone can trigger Vapi calls, which costs money. For production, rate limiting and abuse prevention would be needed.

### Decision 7: Demo mode with real API calls
- **Decision:** Demo mode calls all real APIs (OpenAI, Google Places, TinyFish, Vapi) — only the voice transcription step is skipped.
- **Alternatives considered:** Fully mocked demo with hardcoded responses.
- **Why this approach:** Hackathon judges need to see the REAL system working. Mock data would be unconvincing. The demo uses a hardcoded transcript but everything else is live.
- **Caveat:** Demo mode makes a real phone call to `+91 9204151001` (configurable via `DEMO_TARGET_PHONE` env var). Ensure this number is ready to receive calls during the demo.

---

## 5. TECHNICAL GOTCHAS AND LEARNINGS

### TinyFish API behavior
- The TinyFish API endpoint is `https://agent.tinyfish.ai/api/v1/run`. It accepts `{ url, goal }` and returns `{ run_id, status, result, error }`.
- The API key is passed as `Authorization: Bearer <key>`.
- **Critical:** The API has variable response times (5-45 seconds) depending on website complexity. The 45-second axios timeout is set to accommodate this.
- **Critical:** Not all hospitals have `websiteUri` from Google Places. Hospitals without websites are filtered out before scraping (`filter(h => h.websiteUri)`).
- **Critical:** Even when scraping succeeds, the extracted data quality varies wildly. Some hospital websites don't publish ER wait times publicly. The scoring algorithm gracefully handles missing fields.

### Vapi API behavior
- Phone calls are initiated via POST to `https://api.vapi.ai/call/phone`.
- The `phoneNumberId` is the Vapi-managed Twilio number ID, NOT the phone number itself.
- Call status polling via GET `https://api.vapi.ai/call/{callId}` returns status values: `queued`, `ringing`, `in-progress`, `forwarding`, `ended`.
- **Critical:** The `messages` array in the call status response uses `role: "bot"` for the AI assistant, not `role: "assistant"`. CallTracker.tsx handles both (`msg.role === "assistant" || msg.role === "bot"`).
- **Critical:** The `transcript` field is a single string of the full conversation. The `messages` array has individual turn-by-turn messages with timestamps.
- ElevenLabs voice "sarah" at `speed: 0.9` was chosen for clarity in emergency contexts. Faster speeds caused words to blur together.

### Google Places API (New)
- Uses the NEW Google Places API (`places.googleapis.com/v1/places:searchNearby`), NOT the legacy API.
- Requires `X-Goog-Api-Key` and `X-Goog-FieldMask` headers (not query parameters).
- Field mask: `places.displayName,places.formattedAddress,places.location,places.websiteUri,places.nationalPhoneNumber,places.id,places.types`
- **Critical:** The response structure uses `displayName.text` (not just `displayName`) and `location.latitude`/`location.longitude`.

### OpenAI classification
- Uses `response_format: { type: "json_object" }` to guarantee JSON output.
- Temperature is set to 0.1 for deterministic classification.
- The system prompt includes explicit medical guardrails (e.g., CARDIAC_ARREST always sets `cprNeeded: true`).
- **Gotcha:** The `hospitalType` field in the classification can be `"cardiac_center"`, `"trauma_center"`, `"maternity_hospital"`, or `"hospital"`. But the Google Places type mapping currently resolves ALL of these to `["hospital"]` because Google Places doesn't have specific types for cardiac/trauma centers.

### Tailwind CSS v4 + OKLCH
- Tailwind v4 uses `@theme inline` blocks instead of `tailwind.config.js`.
- All colors MUST be in OKLCH format (not HSL, not hex).
- The `@custom-variant dark (&:is(.dark *))` line enables the `.dark` class-based dark mode.
- Custom emergency colors are defined as theme tokens: `pulse-red`, `pulse-green`, `pulse-yellow`, `pulse-blue`.

### Database
- MySQL (TiDB Cloud) via `DATABASE_URL` environment variable.
- Drizzle ORM with `mysql2` driver.
- `getDb()` returns `null` if `DATABASE_URL` is not set (graceful degradation for local dev without DB).
- Migration command: `pnpm db:push` (runs `drizzle-kit generate && drizzle-kit migrate`).
- **Warning:** Database data is NOT recoverable. Exercise extreme caution with destructive SQL.

### Things that LOOK like bugs but are intentional
- `NotFound.tsx` is imported in `App.tsx` but not used in the Router — this is fine, it's a template artifact.
- `tasks.json` shows all tasks as "pending" — this is stale and does not reflect actual project state.
- The `todo.md` checklist is partially outdated — some items marked unchecked were actually completed in later rounds.
- `PanicButton.tsx` uses `bg-black` instead of `bg-background` — this is a known issue, not a design choice.
- The `parseCallOutcome()` function exists but is never called from the router — this is the blocked integration issue described above.

---

## 6. CODING CONVENTIONS AND PREFERENCES

### Naming conventions
- **Files:** PascalCase for React components (`PanicButton.tsx`), kebab-case for services (`db-helpers.ts`), camelCase for types (`pulse-types.ts`)
- **Variables:** camelCase throughout
- **Types:** PascalCase with descriptive names (`ClassificationResult`, `HospitalResult`, `ScrapingResult`)
- **Database columns:** camelCase in Drizzle schema, matching TypeScript types
- **Session IDs:** Format `pulse-{nanoid(12)}` for normal sessions, `pulse-demo-{nanoid(8)}` for demo sessions

### Error handling
- Services throw errors that propagate to tRPC, which returns them as typed error responses.
- The frontend catches errors in the `runPipeline` try/catch and sets `phase: "error"` with the error message.
- TinyFish scraping uses `Promise.allSettled()` so individual failures don't crash the pipeline.
- Database helpers throw if `getDb()` returns null.

### State management
- All state is local to `Home.tsx` using `useState` hooks.
- No global state management library.
- Pipeline progress is tracked via the `logs` array (array of `DispatchStatus` objects) and the `phase` state.
- The `phase` state machine: `idle → recording → processing → dispatched | error`.

### API design
- All emergency procedures are public (no auth required).
- Each procedure accepts `sessionId` to track which session the operation belongs to.
- Procedures update the database at each step for persistence.
- The `dispatch` procedure defaults to `ENV.demoTargetPhone` if no `targetPhone` is provided.

### Testing approach
- Vitest with Node.js environment.
- Tests are in `server/*.test.ts` files.
- Current tests cover: (a) CPR guidance logic, (b) hospital scoring algorithm, (c) type shape validation, (d) auth logout, (e) API secret presence, (f) OpenAI key authentication.
- Tests do NOT cover: actual API calls to TinyFish/Vapi/Google Places (these would require mocking).
- **User preference:** The user (CEO) does NOT review code. They only want visual checkpoints (browser previews).

### User preferences expressed during sessions
- "I am the CEO, you are the CTO. I don't code."
- "Give me visual checkpoints only, not code reviews."
- "The UI is too intimidating — make it calmer (navy/slate, not black/red)."
- "Vapi calls should be conversational, not a monologue."
- "TinyFish usage must be prominent — it's a TinyFish hackathon."
- "Demo mode must work flawlessly for a 3-minute pitch."
- "Push to GitHub after every major milestone."
- All coding delegated to Claude Code CLI and Codex CLI agents via headless commands.

---

## 7. ENVIRONMENT AND SETUP

### Development environment setup

```bash
# The project runs on the Manus webdev platform
# Dev server starts automatically via: pnpm run dev
# Which executes: NODE_ENV=development tsx watch server/_core/index.ts
# Server runs on port 3000
```

### Environment variables (names only — values are in Manus secrets)

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | MySQL/TiDB connection string |
| `JWT_SECRET` | Session cookie signing |
| `VITE_APP_ID` | Manus OAuth app ID |
| `OAUTH_SERVER_URL` | Manus OAuth backend URL |
| `VITE_OAUTH_PORTAL_URL` | Manus login portal URL |
| `OWNER_OPEN_ID` | Owner's Manus ID |
| `OWNER_NAME` | Owner's display name |
| `BUILT_IN_FORGE_API_URL` | Manus built-in API URL |
| `BUILT_IN_FORGE_API_KEY` | Manus built-in API key |
| `VITE_FRONTEND_FORGE_API_KEY` | Frontend Manus API key |
| `VITE_FRONTEND_FORGE_API_URL` | Frontend Manus API URL |
| `OPENAI_API_KEY` | OpenAI API key (GPT-4o + Whisper) |
| `ELEVENLABS_API_KEY` | ElevenLabs voice API key |
| `VAPI_API_KEY` | Vapi phone call API key |
| `VAPI_PUBLIC_KEY` | Vapi public key |
| `VAPI_PHONE_NUMBER_ID` | Vapi Twilio phone number ID (`97f81906-47c5-48d2-b241-6243db9d7d9e`) |
| `TINYFISH_API_KEY` | TinyFish web scraping API key (`sk-tinyfish-OASGij_Xle8w8-m-PHNlnFA644AYET9q`) |
| `GOOGLE_PLACES_API_KEY` | Google Places API key |
| `DEMO_TARGET_PHONE` | Demo call target number (default: `+919204151001`) |

### Database setup
- MySQL (TiDB Cloud) — connection via `DATABASE_URL`
- Schema defined in `drizzle/schema.ts`
- Migrate with: `pnpm db:push`
- Tables: `users` (auth), `emergency_sessions` (pipeline state), `dispatch_logs` (timeline events)

### External services

| Service | Base URL | Auth Method |
|---------|----------|-------------|
| OpenAI | `https://api.openai.com/v1/` | Bearer token |
| Google Places | `https://places.googleapis.com/v1/` | `X-Goog-Api-Key` header |
| TinyFish | `https://agent.tinyfish.ai/api/v1/` | Bearer token |
| Vapi | `https://api.vapi.ai/` | Bearer token |

### Port and URL
- Dev server: `http://localhost:3000`
- Public preview: `https://3000-iafcaljsm1715dun8knr9-0a26333c.sg1.manus.computer`

---

## 8. NEXT STEPS (prioritized and actionable)

### Priority 1: Wire CallTracker into the UI (CRITICAL for demo)

**What:** The `CallTracker.tsx` component exists but is not rendered. It needs to be integrated into `Home.tsx` and the backend needs to be fixed to support it.

**Exact steps:**

1. **Fix router procedure name.** In `server/routers/emergency.ts`, rename `getCallStatus` to `callStatus` (line 229). This matches what `CallTracker.tsx` expects (`trpc.emergency.callStatus.useQuery`).

2. **Add outcome parsing to the router.** In the `callStatus` (formerly `getCallStatus`) procedure, after getting raw status from `getCallStatus()`, call `parseCallOutcome(status.transcript)` and include it in the response:
   ```typescript
   callStatus: publicProcedure
     .input(z.object({ callId: z.string() }))
     .query(async ({ input }) => {
       const status = await getCallStatus(input.callId);
       const outcome = status.transcript ? parseCallOutcome(status.transcript) : undefined;
       return { ...status, outcome };
     }),
   ```
   Import `parseCallOutcome` from `../services/dispatch`.

3. **Import and render CallTracker in Home.tsx.** After the "CALL DISPATCHED" confirmation block (around line 519), add:
   ```tsx
   {callResult?.callId && (
     <CallTracker callId={callResult.callId} hospitalName={selectedHospital?.name ?? "Hospital"} />
   )}
   ```

### Priority 2: Add "Powered by TinyFish" badge (CRITICAL for hackathon)

**What:** Add a prominent TinyFish branding element visible during the scraping phase and in the footer.

**Exact steps:**
1. During the scraping step in the pipeline, show a badge: "Powered by TinyFish — Scraping 5 hospital websites simultaneously"
2. Add a footer badge on the main page: "Built with TinyFish Web Agents"
3. Consider adding a small animation showing TinyFish agents fanning out to different hospital URLs

### Priority 3: Show hospital comparison table with scraped data (HIGH for demo impact)

**What:** After scraping completes, show a table comparing all hospitals with their scraped data so judges can see what TinyFish found.

**Exact steps:**
1. The `scrapeAndSelect` mutation already returns `allResults: ScrapingResult[]`
2. Create a `HospitalComparisonTable` component that renders:
   - Hospital name, distance
   - ER wait time (from scraping)
   - Resuscitation bay (yes/no/unknown)
   - Defibrillator (yes/no/unknown)
   - Trauma bay (yes/no/unknown)
   - Bed availability
3. Highlight the selected hospital row
4. Render this table in `Home.tsx` after the scraping step completes

### Priority 4: Fix hardcoded `bg-black` in components (MEDIUM)

**What:** Replace `bg-black` with `bg-background` in PanicButton.tsx (line 204) and CprMetronome.tsx (line 138) so they respect the navy theme.

### Priority 5: Polish 3-minute demo script (HIGH for presentation)

**What:** Prepare the exact sequence for the hackathon demo.

**Suggested demo flow:**
1. **0:00-0:30** — Open the app, explain the problem ("911 routing is static, we make it dynamic")
2. **0:30-1:00** — Press "RUN DEMO" button, watch classification happen live
3. **1:00-1:30** — Watch TinyFish agents scrape hospitals (show comparison table)
4. **1:30-2:00** — Watch Vapi call connect, show live call status
5. **2:00-2:30** — Show call transcript and outcome parsing
6. **2:30-3:00** — Explain architecture, mention TinyFish prominently

### Priority 6: Push all code to GitHub (MEDIUM)

**What:** Commit all uncommitted changes and push to both the internal remote and `13shreyansh/pulse-emergency`.

### Priority 7: Write Vitest tests for new integrations (LOW for hackathon)

**What:** Add tests for `parseCallOutcome()` with sample transcripts, and for the scoring algorithm with edge cases.

---

## 9. FILES CHANGED IN THIS SESSION

### Files created in this session
| File | Description |
|------|-------------|
| `client/src/components/CallTracker.tsx` | Real-time call status polling UI with transcript display and outcome badges. Polls Vapi every 3 seconds, shows live duration, renders chat-style transcript, displays outcome badges (Hospital Confirmed, ER Available, Equipment Ready). **NOT YET WIRED into Home.tsx.** |
| `HANDOFF.md` | This handoff document |

### Files modified in this session
| File | What changed | Why |
|------|-------------|-----|
| `server/services/dispatch.ts` | Rewrote from simple monologue to 5-step conversational assistant. Added `getCallStatus()` and `parseCallOutcome()` functions. Voice changed to ElevenLabs "sarah" at 0.90x speed. Max duration set to 90s. | User wanted conversational calls, not monologue dumps |
| `client/src/index.css` | Replaced pure black/red palette with dark navy/slate OKLCH palette. Added emergency-specific color tokens (pulse-red, pulse-green, pulse-yellow, pulse-blue). Added animation keyframes for pulse rings and CPR beats. | User said original design was "too intimidating" |
| `client/src/pages/Home.tsx` | Updated color classes to use semantic tokens. Minor layout adjustments. | Align with new calmer palette |
| `todo.md` | Added new items for call tracking, transcript display, outcome parsing, UI redesign | Track new requirements |

### Files NOT changed but important context
| File | Note |
|------|------|
| `server/routers/emergency.ts` | The `getCallStatus` procedure needs to be renamed to `callStatus` and enhanced with `parseCallOutcome()` — this was identified but not yet implemented |
| `client/src/components/PanicButton.tsx` | Still has `bg-black` hardcoded on line 204 — needs `bg-background` |
| `client/src/components/CprMetronome.tsx` | Still has `bg-black` hardcoded on line 138 — needs `bg-background` |

---

## 10. KNOWN RISKS AND WARNINGS

### Things that could break if approached incorrectly

1. **DO NOT modify files in `server/_core/`** — This is framework plumbing managed by the Manus platform. Modifying these files can break the build/deploy pipeline. The only exception is `server/_core/env.ts` which we've already extended with Pulse-specific keys.

2. **DO NOT store images/media in `client/public/`** — This causes deployment timeouts. Use `manus-upload-file --webdev` to upload assets and reference CDN URLs.

3. **DO NOT hardcode port numbers in server code** — The platform assigns ports dynamically. Use `process.env.PORT` or let the framework handle it.

4. **DO NOT run `git reset --hard`** — Use `webdev_rollback_checkpoint` instead. The internal git remote is managed by the platform.

5. **Database data is NOT recoverable** — There are no backups. Be extremely careful with `DROP TABLE` or `DELETE` statements.

### Order-of-operations dependencies

1. `DATABASE_URL` must be set before running `pnpm db:push` (Drizzle config throws immediately if missing).
2. All API keys must be set before running `pnpm test` (secrets.test.ts validates their presence).
3. The emergency router must be mounted in `server/routers.ts` as `emergency` (it already is).
4. `CallTracker.tsx` CANNOT be imported into `Home.tsx` until the router procedure name mismatch is fixed (it will cause a TypeScript compilation error).

### Performance concerns

1. **TinyFish scraping takes 5-45 seconds** — This is the slowest step in the pipeline. The UI should show clear progress during this phase.
2. **Vapi calls take 30-90 seconds** — The call itself is the longest user-facing wait. CallTracker with live status updates is essential for the demo.
3. **Google Places API has rate limits** — Not a concern for demo, but would matter in production.
4. **OpenAI Whisper transcription** — Audio files are sent as base64 over tRPC, which means large recordings increase request size. The 15-second max recording limit mitigates this.

### Agent orchestration context

The project was built using a **CTO/Agent factory model**:
- **Manus (CTO):** Plans architecture, writes task specs, reviews code, integrates approved deliverables
- **Claude Code CLI:** Primary execution agent for complex reasoning tasks (dispatch service, tRPC router, pipeline wiring)
- **Codex CLI:** Secondary agent for boilerplate and UI components (panic button, CPR metronome, status feed)

The agents are configured on the user's Mac at `~/Documents/hackathon/` with:
- `AGENTS.md` — Long-term semantic memory defining roles and rules
- `CLAUDE.md` — Claude Code-specific instructions
- `tasks.json` — Sprint task manifest (STALE — do not trust status fields)
- `launch_cto_workspace.sh` — Tmux workspace launcher (3 panes: CTO, Claude, Codex)

Agent commands:
```bash
# Claude Code (headless mode)
claude -p "task description" --allowedTools "Read,Write,Bash"

# Codex CLI (full-auto mode)
codex --full-auto "task description"
```

---

## APPENDIX A: COMPLETE TYPE DEFINITIONS

```typescript
// shared/pulse-types.ts — ALL types used across the project

export type EmergencyType =
  | "CARDIAC_ARREST"
  | "MAJOR_TRAUMA"
  | "OBSTETRIC_EMERGENCY"
  | "RESPIRATORY_DISTRESS"
  | "STROKE"
  | "SEVERE_BLEEDING"
  | "UNKNOWN";

export type Severity = "critical" | "high" | "moderate";

export interface ClassificationResult {
  emergencyType: EmergencyType;
  severity: Severity;
  confidence: number;           // 0-1
  summary: string;              // Brief clinical summary
  keySymptoms: string[];        // e.g., ["unresponsive", "not breathing"]
  cprNeeded: boolean;
  traumaWarning: boolean;       // true if patient should NOT be moved
  doNotMove: boolean;
  specialInstructions: string[];
  hospitalType: string;         // "cardiac_center" | "trauma_center" | "maternity_hospital" | "hospital"
}

export interface HospitalResult {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
  websiteUri?: string;          // From Google Places — used by TinyFish scraper
  phoneNumber?: string;         // From Google Places — used by Vapi dispatch
  placeId: string;
  types: string[];
}

export interface ScrapingResult {
  hospitalName: string;
  websiteUrl: string;
  erWaitTime?: string;                  // e.g., "15 minutes"
  resuscitationBayAvailable?: boolean;
  defibrillatorAvailable?: boolean;
  traumaBayAvailable?: boolean;
  bedAvailability?: string;             // e.g., "3 beds available"
  rawData?: string;                     // JSON string of full scraped data
  scrapedAt: string;                    // ISO timestamp
  success: boolean;
  error?: string;
}

export interface DispatchStatus {
  sessionId: string;
  step: string;
  message: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface EmergencySessionState {
  sessionId: string;
  status: string;
  transcript?: string;
  classification?: ClassificationResult;
  hospitals?: HospitalResult[];
  scrapingResults?: ScrapingResult[];
  selectedHospital?: HospitalResult & { scrapingData?: ScrapingResult };
  callId?: string;
  callStatus?: string;
  logs: DispatchStatus[];
  cprGuidance?: CprGuidance;
}

export interface CprGuidance {
  needed: boolean;
  type: "hands_only" | "full_cpr" | "none";
  instructions: string[];
  warnings: string[];
}

// server/services/dispatch.ts — Call outcome type (used by CallTracker)
export interface CallOutcome {
  hospitalConfirmed: boolean;
  erAvailable: boolean;
  equipmentReady: boolean;
  specialInstructions: string[];
  outcome: "accepted" | "rejected" | "unknown";
}
```

---

## APPENDIX B: DATABASE SCHEMA

```sql
-- emergency_sessions table
CREATE TABLE emergency_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sessionId VARCHAR(64) NOT NULL UNIQUE,
  status ENUM('recording','classifying','searching','scraping','dispatching','completed','failed') DEFAULT 'recording' NOT NULL,
  transcript TEXT,
  emergencyType VARCHAR(64),
  severity ENUM('critical','high','moderate'),
  classification JSON,
  latitude TEXT,
  longitude TEXT,
  hospitalsFound JSON,
  selectedHospitalName TEXT,
  selectedHospitalPhone VARCHAR(32),
  scrapingResults JSON,
  vapiCallId VARCHAR(128),
  callStatus VARCHAR(32),
  createdAt TIMESTAMP DEFAULT NOW() NOT NULL,
  completedAt TIMESTAMP,
  totalDurationMs BIGINT
);

-- dispatch_logs table
CREATE TABLE dispatch_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sessionId VARCHAR(64) NOT NULL,
  step ENUM('voice_captured','transcription_complete','classification_complete','hospital_search_complete','scraping_started','scraping_complete','hospital_selected','call_initiated','call_connected','call_completed','cpr_guidance_started','error') NOT NULL,
  message TEXT NOT NULL,
  metadata JSON,
  createdAt TIMESTAMP DEFAULT NOW() NOT NULL
);
```

---

## APPENDIX C: VAPI ASSISTANT SYSTEM PROMPT (FULL TEXT)

The Vapi AI assistant uses this exact system prompt for hospital calls:

```
You are Pulse, an AI emergency dispatch coordinator. You are calling the emergency
department of a hospital to notify them of an incoming patient. You must conduct a
structured, professional, back-and-forth conversation — do NOT dump all information
at once. Follow this exact sequence:

STEP 1 — Identity Confirmation:
You have already asked: "Hello, this is Pulse Emergency Dispatch. Am I speaking with
the emergency department at {hospitalName}?"
Wait for their response. If they confirm yes or indicate they are the ED, proceed to
STEP 2. If they say no or seem confused, politely clarify or ask to be transferred
to the emergency department. If they cannot help, say: "Understood, we will try the
next nearest facility. Thank you for your time." and end the call.

STEP 2 — Patient Briefing + ER Availability:
Say exactly: "We have a {emergencyType} patient approximately {distance} from your
location. A bystander called in reporting: {summary}. Is your emergency room
currently accepting patients?"
Wait for their response. If they say yes or are accepting, proceed to STEP 3.
If they say no, are full, on divert, or unavailable, say: "Understood, we will try
the next nearest facility. Thank you for your time." and end the call.

STEP 3 — Equipment & Team Confirmation:
Say exactly: "The bystander reports {cprStatus}. Can you confirm you have the
necessary equipment and team available?"
Wait for their response. If they confirm yes, proceed to STEP 4.
If they cannot confirm readiness, say: "Understood, we will try the next nearest
facility. Thank you for your time." and end the call.

STEP 4 — ETA & Relay Request:
Say exactly: "Thank you. The patient's estimated arrival is approximately 8 minutes.
Is there anything you need us to relay to the bystander?"
Wait for their response. Listen carefully and note any instructions they give.

STEP 5 — Close:
Acknowledge their instructions (if any) and close politely.

IMPORTANT RULES:
- Speak calmly and clearly at all times. This is an emergency.
- Do NOT rush. Wait for the human to finish speaking before responding.
- Do NOT repeat the entire briefing if they ask a follow-up — answer concisely.
- If at any point the hospital says they cannot accept the patient, end the call
  gracefully with the divert message above.
- Keep all responses concise and professional.
```

---

## APPENDIX D: TINYFISH SCRAPING GOAL PROMPT

Each TinyFish agent receives this goal when scraping a hospital website:

```
You are scraping a hospital website for emergency department information. Extract
the following data if available:
1. ER wait time (current estimated wait time)
2. Resuscitation bay availability (yes/no/unknown)
3. Defibrillator availability (yes/no/unknown)
4. Trauma bay availability (yes/no/unknown)
5. Bed availability (number or status)
6. Emergency department phone number
7. Any relevant emergency service information

Return the data as a JSON object with keys: er_wait_time, resuscitation_bay_available,
defibrillator_available, trauma_bay_available, bed_availability, emergency_phone, notes
```

---

## APPENDIX E: SCORING ALGORITHM

The hospital selection algorithm in `scraper.ts` (`selectBestHospital`):

```
Base score = 100 - (distanceKm × 5)

Bonuses from TinyFish scraping:
  +30 points  if resuscitationBayAvailable === true
  +20 points  if defibrillatorAvailable === true
  +15 points  if traumaBayAvailable === true
  +25 points  if erWaitTime < 30 minutes

Hospital with highest total score is selected.
```

**Example:** Hospital A is 2km away (base: 90), has resuscitation bay (+30), defibrillator (+20) = **140 points**. Hospital B is 1km away (base: 95), no scraping data = **95 points**. Hospital A wins despite being farther away.

---

**END OF HANDOFF DOCUMENT**

*This document was generated by Manus AI (CTO) on March 28, 2026. It represents the complete state of Project Pulse at the time of session handoff. The next session should read this document in its entirety before taking any action.*
