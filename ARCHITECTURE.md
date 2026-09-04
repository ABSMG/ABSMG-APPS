# LifeOS — Universal Everyday AI Assistant
> *"Ask. Plan. Learn. Do."*

## Architectural Blueprint & System Design (A–J)

### A. Product Architecture
LifeOS is designed as a modular, offline-resilient, mobile-first ecosystem.
1. **Presentation Layer (Client SPA & PWA)**:
   - Built on React 19, Tailwind CSS, Lucide icons, and Motion animations.
   - Designed for low-latency rendering (<100ms) on inexpensive Android chipsets.
   - Supports low-data mode (bypasses heavy assets, reduces token lengths, and batches network requests).
2. **Application Core (Client State & Local DB)**:
   - Reactive store with durable local cache (`LifeOSDB` via IndexedDB/LocalStorage).
   - Optimistic updates with offline queues for intermittent African/global connectivity.
   - Voice audio engine leveraging Web Speech API with automatic server fallback.
3. **Gateway & API Service Layer (Express Server)**:
   - Encapsulated `/api/*` endpoints with rate limiting and request validation.
   - Security filters guarding against prompt injection and cross-site abuses.
4. **AI & Intelligence Engine**:
   - Google Gemini 3.8 Flash (`@google/genai`) configured server-side with strict grounding.
   - Intent parsing router: classifies inputs into Direct Answer, Planning/Scheduling, Learning, Translation, or Structured Action.
   - User-controlled memory injection system with explicit memory inspection and deletion.

---

### B. User Flow
1. **Onboarding / Welcome**:
   - Frictionless entry: 3-step setup (Name & Region, Preferred Language, Primary Goal e.g., Studies, Work, Savings).
   - Instant guest access with option to create password-protected profile.
2. **Unified Home Screen Experience ("What do you want to do?")**:
   - Universal omni-input: user speaks or types any thought.
   - Intent recognition: system dynamically decides whether to converse, schedule, teach, translate, or execute.
   - Action confirmation: if an actionable request is detected (e.g. "Remind me tomorrow at 8am"), system presents a confirmation card before committing.
3. **Dedicated Core Workspaces**:
   - **Search Workspace**: Deep, transparent query answering with distinct categorization of *Verified Facts*, *Estimates*, and *Uncertainties*.
   - **Planner Workspace**: Today's schedule, task check-off, habit tracking, and Natural Language Smart Schedule generator.
   - **Learning Workspace**: Topic picker, personalized difficulty levels, AI Tutor chat, interactive quiz, and flashcards.
   - **Profile & Memory Workspace**: Full transparency into stored user memories, privacy switches, low-data toggle, and data export.

---

### C. Screen List
1. `ScreenHome`: Omni-search/chat bar, Voice trigger, Suggested Action chips, Recent Activity, Today's Schedule glimpse.
2. `ScreenSearch`: Universal query engine, factual breakdown cards, citation sources, follow-up actions.
3. `ScreenPlanner`: Daily agenda, time-blocking, task list, habit trackers, and AI schedule optimizer.
4. `ScreenLearn`: Subject explorer, Interactive Tutor, Quiz module with immediate scoring, Flashcard viewer.
5. `ScreenProfile`: User settings, Personalization attributes, Memory manager, Export/Clear data, Security controls.
6. `ModalVoiceAssistant`: Real-time voice interaction interface with live waveform and voice synthesis.
7. `ModalActionConfirm`: Confirmation dialog ensuring no destructive or calendar action runs without user consent.
8. `ModalAuth`: Login, Sign Up, and Profile switching.
9. `ModalTranslator`: Quick multi-lingual translator with audio pronunciation.

---

### D. Database Schema (Relational & Document Model)
```sql
-- Users & Security
CREATE TABLE users (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  email VARCHAR(255) UNIQUE,
  preferred_language VARCHAR(16) DEFAULT 'en',
  country VARCHAR(64),
  tier VARCHAR(16) DEFAULT 'FREE', -- FREE, PLUS, BUSINESS
  low_data_mode BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User-Controlled Memories
CREATE TABLE user_memories (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
  category VARCHAR(32), -- 'preference', 'goal', 'habit', 'fact'
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Daily Planner Tasks & Reminders
CREATE TABLE planner_items (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  type VARCHAR(32) NOT NULL, -- 'task', 'reminder', 'schedule_block'
  scheduled_date DATE,
  start_time VARCHAR(16),
  end_time VARCHAR(16),
  completed BOOLEAN DEFAULT FALSE,
  priority VARCHAR(16) DEFAULT 'normal', -- 'low', 'normal', 'high'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habits
CREATE TABLE habits (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(128) NOT NULL,
  streak_count INTEGER DEFAULT 0,
  last_completed_date DATE,
  frequency VARCHAR(32) DEFAULT 'daily'
);

-- Financial Records (Income, Expenses, Budgets)
CREATE TABLE financial_records (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(16) NOT NULL, -- 'income', 'expense', 'budget'
  category VARCHAR(64) NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  currency VARCHAR(8) DEFAULT 'USD',
  date DATE NOT NULL,
  notes TEXT
);

-- Learning Tracks & Progress
CREATE TABLE learning_progress (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
  topic VARCHAR(128) NOT NULL,
  proficiency_level VARCHAR(32), -- 'beginner', 'intermediate', 'advanced'
  quiz_score INTEGER DEFAULT 0,
  flashcards_reviewed INTEGER DEFAULT 0,
  last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

### E. API Architecture
- `POST /api/ai/assistant`:
  - Request: `{ message: string, history: Array<{role, content}>, userProfile: UserProfile, memories: Memory[] }`
  - Response: `{ reply: string, detectedAction?: SmartAction, newMemory?: string }`
- `POST /api/ai/search`:
  - Request: `{ query: string, language?: string }`
  - Response: `{ summary: string, verifiedFacts: string[], estimates: string[], uncertainties: string[], sources: Array<{title, url}>, suggestedActions: string[] }`
- `POST /api/ai/smart-schedule`:
  - Request: `{ input: string, date: string }`
  - Response: `{ schedule: Array<{ time: string, title: string, category: string, durationMinutes: number }> }`
- `POST /api/ai/learn`:
  - Request: `{ topic: string, level: string, mode: 'lesson' | 'quiz' | 'flashcards' }`
  - Response: `{ lessonContent?: string, quiz?: Array<{question, options, correctIndex, explanation}>, flashcards?: Array<{front, back}> }`
- `POST /api/ai/translate`:
  - Request: `{ text: string, targetLanguage: string, sourceLanguage?: string }`
  - Response: `{ translatedText: string, phoneticGuide?: string, notes?: string }`
- `POST /api/ai/action-parse`:
  - Request: `{ input: string }`
  - Response: `{ actionType: 'TASK' | 'REMINDER' | 'BUDGET' | 'NONE', payload: Record<string, any> }`

---

### F. Recommended Technology Stack
- **Frontend**: React 19 + TypeScript, Vite 6, Tailwind CSS 4, Motion, Lucide Icons.
- **Backend / API**: Express 4 running on Node.js / Cloud Run.
- **AI SDK**: `@google/genai` with model `gemini-3.8-flash`.
- **Speech Engine**: Web Speech Recognition + Web Speech Synthesis with graceful fallback.
- **Data Persistence**: Offline-first client cache + Cloud Firestore/PostgreSQL in production.

---

### G. Security & Privacy Architecture
1. **Zero Secret Leaks**: All Gemini API keys strictly encapsulated on server.
2. **Minimal Data Footprint**: No unnecessary background tracking; all analytics privacy-preserving.
3. **Explicit User Memory Control**: Every fact remembered by the AI is displayed in the user profile and can be individually deleted with one tap.
4. **Action Confirmation Boundary**: Any write action (calendar mutation, habit deletion, external request) requires explicit user confirmation.
5. **Prompt Injection Hardening**: Strict delimiter isolation and JSON schemas for all structured outputs.

---

### H. AI Architecture
- **Model**: `gemini-3.8-flash` for high throughput, sub-second latency, and low memory overhead.
- **Telemetry**: Configured with `User-Agent: aistudio-build`.
- **System Guardrails**:
  - Distinguish facts from estimates and uncertainties.
  - Deliver concise, culturally sensitive answers.
  - Support multilingual translation with vernacular accuracy (e.g. Swahili, French, Hindi).

---

### I. MVP Roadmap (Phase 1, Phase 2, Phase 3)
- **Phase 1 (Current MVP)**:
  - Complete Mobile Application Shell with Home, Search, Planner, Learn, and Profile.
  - Conversational AI Assistant with smart action detection.
  - Voice-first interface (mic input & voice readback).
  - Universal Search with fact/estimate/uncertainty separation.
  - Daily Life Planner with task management, reminders, and Natural Language Schedule Generator.
  - Learning Hub with AI tutor, Quiz generator, and Flashcards.
  - Multi-language support and Translator.
  - User-Controlled Memory viewer & profile settings.
- **Phase 2 (Expansion)**:
  - Document AI (multi-page PDF / image OCR summarization and Q&A).
  - Family & Shared Spaces (collaborative shopping lists and household calendars).
  - Financial Money Management budget tracker with offline receipt scanning.
- **Phase 3 (Global Scale)**:
  - Native Android/iOS builds via Capacitor/React Native.
  - SMS & WhatsApp gateway for zero-data/feature-phone access in emerging markets.
  - Local edge LLM models (MediaPipe/Gemma) for 100% offline edge generation.

---

### J. Monetization Architecture
- **FREE Tier (Empowering the World)**:
  - Generous daily queries, essential daily planner, universal search, basic AI tutor, full offline access to cached data.
  - Zero frustrating dark patterns or artificial throttling.
- **PLUS Tier ($4.99/mo or regional purchasing power parity $1.99 in emerging markets)**:
  - Unlimited AI queries, advanced document uploads, extended memory retention, personalized voice models.
- **BUSINESS / FAMILY Tier ($9.99/mo)**:
  - Shared family spaces, collaborative planners, multi-seat team workspaces, priority server SLA.
