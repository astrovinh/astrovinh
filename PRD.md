# 😺 DevPet — PRD v1.1 (Updated: Platform, Tech Stack & 4-Week Timeline)

**DevPet** — *Level up your vibe coding*

PRD v1.1 · Updated March 2026 · Platform expansion, detailed tech stack, compressed timeline

> ℹ️ **What changed in v1.1:** Added cross-platform strategy (macOS + Windows + iOS), detailed backend/infrastructure architecture, expanded tech stack, and compressed the entire build into a 4-week sprint timeline.
>

---

# Platform Strategy

## Target Platforms

| Platform | Priority | Timeline | Notes |
| --- | --- | --- | --- |
| **macOS** (desktop) | P0 — Launch platform | Week 1-4 | Primary development target. Native process monitoring, menubar app. |
| **Windows** (desktop) | P1 — Fast follow | Week 5-6 | Same Tauri codebase. Platform-specific process monitoring branch. |
| **iOS** (companion) | P2 — Phase 2 | Week 7-10 | Read-only companion: view sessions, skills, insights from phone. |
| **Linux** (desktop) | P3 — Community request | Future | Tauri supports Linux natively. Lower priority but low effort to add. |

## Cross-Platform Architecture

Tauri 2.0 compiles to native binaries for macOS, Windows, and Linux from a single codebase. The key architectural decision:

- **Frontend (React + TypeScript):** 100% shared across all desktop platforms. No platform-specific UI code needed.
- **Backend (Rust):** 95% shared. The only platform-specific code is the process monitoring module, which uses different OS APIs:
    - macOS: `sysinfo` crate + `NSWorkspace` for app detection
    - Windows: `sysinfo` crate + `windows` crate for process enumeration
    - Both use the same trait interface so the rest of the app is platform-agnostic
- **iOS companion:** Separate React Native app (or Swift/SwiftUI) that reads from a synced data layer

## Build Strategy: macOS First, Then Expand

**Why macOS first:**

- Most vibe coders use macOS (Cursor, VS Code, Terminal are macOS-primary)
- Tauri's macOS support is most mature
- Smaller surface area for QA
- Can ship faster and learn from real users

**Adding Windows (Week 5-6):**

- Swap process monitor to Windows APIs (already abstracted behind a trait)
- Test build pipeline with `tauri build --target windows`
- Platform-specific installer (MSI/NSIS)
- Estimated effort: 1-2 weeks due to shared codebase

---

# Detailed Tech Stack

## Desktop Application

| Layer | Technology | Version | Purpose |
| --- | --- | --- | --- |
| App Framework | **Tauri 2.0** | 2.x stable | Cross-platform desktop shell. Rust backend, webview frontend. ~5MB binary vs ~150MB Electron. |
| Frontend Framework | **React 18** | 18.3+ | Component-based UI matching all prototypes exactly. |
| Language | **TypeScript 5** | 5.4+ | Type safety across all frontend code. |
| Styling | **Tailwind CSS 4** | 4.x | Utility-first CSS matching design tokens. Custom config for DevPet palette. |
| State Management | **Zustand** | 4.x | Lightweight store. Handles session state, skill data, chat messages, UI state. |
| Routing | **React Router** | 6.x | Tab-based navigation (Home, Sessions, Skills, Insights, Profile). |
| Charts | **Recharts** | 2.x | Bar charts, sparklines for Insights page. Lightweight, React-native. |
| Animations | **Framer Motion** | 11.x | Page transitions, card expand/collapse, cat emoji animations. |

## Rust Backend (Tauri)

| Module | Crate / Technology | Purpose |
| --- | --- | --- |
| Process Monitor | `sysinfo` | Detect running AI tools (Cursor, VS Code, Terminal, Ollama, Claude Code) |
| File Watcher | `notify` | Watch project directory for file changes, build events, error logs |
| Database | `rusqlite` (via `tauri-plugin-sql`) | Local SQLite for all persistent data |
| HTTP Client | `reqwest` | Calls to Claude API for chat + analysis |
| Serialization | `serde`  • `serde_json` | Data serialization between Rust and React |
| IPC | Tauri Commands | Type-safe communication between frontend and backend |
| Network Monitor | `pcap` or system proxy | Observe API calls to OpenAI/Anthropic endpoints for cost tracking (Phase 3) |

## Backend / Cloud Infrastructure

| Service | Technology | Purpose |
| --- | --- | --- |
| Landing Page Hosting | **Vercel** | Next.js deployment, edge functions, automatic SSL |
| Waitlist API | **Vercel Serverless Functions** | `/api/waitlist` endpoint for email capture |
| Email Service | **Resend** | Confirmation emails, waitlist updates, launch announcements |
| Database (waitlist) | **Vercel Postgres** or **Supabase** | Store waitlist emails, signup metadata, referral codes |
| Analytics | **Plausible** | Privacy-friendly, lightweight page analytics |
| Error Tracking | **Sentry** | Crash reporting for Tauri app (both Rust panics and JS errors) |
| Sync Server (Phase 2) | **Supabase** or **CloudKit** | Optional cloud sync for iOS companion app. User data stays local by default. |
| AI API | **Anthropic Claude API** (claude-sonnet-4-20250514) | Powers the chat panel, session analysis, weekly narratives, skill assessment |
| CI/CD | **GitHub Actions** | Automated builds for macOS (.dmg), Windows (.msi), and release management |
| Distribution | **GitHub Releases**  • **Sparkle** (macOS) | Auto-update framework. Phase 4: Mac App Store. |

## iOS Companion App (Phase 2)

| Layer | Technology | Purpose |
| --- | --- | --- |
| Framework | **React Native** or **Swift/SwiftUI** | Native iOS experience |
| State | **CloudKit** or **Supabase Realtime** | Sync sessions, skills, insights from desktop |
| Push Notifications | **APNs** | Daily streak reminders, session recaps, achievement unlocks |

**iOS App Scope (read-first):**

- View today's session summary and lessons
- Check skill tree progress and XP
- Browse session history
- Read weekly insights
- Receive streak reminders via push notifications
- Chat with the cat (using Claude API directly)
- **NOT included initially:** Live session monitoring (desktop only)

---

# Compressed 4-Week Sprint Timeline

> 🎯 **Goal: Ship a usable product in 30 days.** This requires aggressive scope cutting and parallel workstreams. The landing page launches in Week 1 while the app is being built.
>

## Week 1: Landing Page + App Foundation

*Ship the landing page on Day 2-3. Start app scaffold simultaneously.*

**Days 1-3: Landing Page (SHIP THIS)**

- [ ]  Register domain ([devpet.com](http://devpet.com) or [dev.pet](http://dev.pet))
- [ ]  Initialize Next.js + Tailwind project
- [ ]  Port `devpet-landing.jsx` prototype to Next.js
- [ ]  Implement EN/VI language toggle
- [ ]  Set up Resend for email capture
- [ ]  Deploy to Vercel
- [ ]  Add Plausible analytics
- [ ]  Post on Twitter/X, LinkedIn, indie hackers

**Days 3-7: Tauri App Scaffold (parallel)**

- [ ]  Initialize Tauri 2.0 + React + TypeScript project
- [ ]  Configure Tailwind with DevPet design tokens
- [ ]  Build the three-column layout shell (LeftNav, MainContent, ChatPanel)
- [ ]  Implement tab routing for all 5 screens
- [ ]  Port static Home dashboard UI from prototype
- [ ]  Port static Skill Tree UI from prototype
- [ ]  Set up SQLite database with schema

## Week 2: Process Monitoring + Core Features

*Make the app actually do something — detect coding sessions and track them.*

**Days 8-10: Process Monitor**

- [ ]  Build Rust process monitor (detect Cursor, VS Code, Terminal, Ollama)
- [ ]  Implement session start/end detection (process lifecycle + 15min idle timeout)
- [ ]  Wire up live session status card on Home dashboard
- [ ]  Display detected tools with status indicators

**Days 11-14: Session Tracking + Storage**

- [ ]  Implement session CRUD in SQLite
- [ ]  Build session event pipeline (process events → stored events → UI)
- [ ]  Port Sessions Library screen with real data
- [ ]  Implement streak tracking and daily goal counter
- [ ]  Basic session summary generation (simple heuristics, not AI yet)

## Week 3: Chat + AI Integration + Skill System

*Add the intelligence layer — the cat becomes a real mentor.*

**Days 15-17: Chat Panel**

- [ ]  Integrate Claude API for chat responses
- [ ]  Build context injection (current project, session state, skill levels)
- [ ]  Implement quick action chips per tab
- [ ]  Add typing indicator and message streaming
- [ ]  Cat mood changes based on conversation context

**Days 18-21: Skill System + XP**

- [ ]  Implement all 16 skills with tier structure
- [ ]  Build XP earning logic based on session events
- [ ]  Level calculation and progression
- [ ]  Wire up Skill Tree screen with live data
- [ ]  Implement "Today's Focus" auto-generation on Home

## Week 4: Polish, Insights, Ship

*Make it feel complete. Cut anything that isn't ready.*

**Days 22-24: Insights + Profile**

- [ ]  Build weekly stats aggregation
- [ ]  AI-generated weekly narrative (Claude API)
- [ ]  Bar charts and sparklines with real session data
- [ ]  Error pattern detection (basic: count error types)
- [ ]  Profile page with level, stats, basic achievements

**Days 25-27: Polish + QA**

- [ ]  Animations and transitions (page loads, card expands, cat mood)
- [ ]  Edge cases: no sessions yet, first-time experience, empty states
- [ ]  Memory leaks, performance testing
- [ ]  Build .dmg installer for macOS
- [ ]  Write README and .cursorrules for the project itself (eat your own dogfood)

**Days 28-30: Beta Launch**

- [ ]  Set up auto-update via Sparkle
- [ ]  Set up Sentry error tracking
- [ ]  Invite first 50 waitlist users to beta
- [ ]  Send launch email via Resend
- [ ]  Post launch announcement (Twitter/X, LinkedIn, communities)
- [ ]  Monitor feedback and triage bugs

---

# What Gets Cut to Ship in 4 Weeks

Being honest about what ships vs what waits:

| Feature | In 4-week ship? | When? |
| --- | --- | --- |
| Landing page (bilingual) | ✅ Yes | Week 1 |
| macOS app with 3-column layout | ✅ Yes | Week 1 |
| Auto-detected sessions | ✅ Yes | Week 2 |
| Session history + storage | ✅ Yes | Week 2 |
| Streak + daily goals | ✅ Yes | Week 2 |
| Chat panel with Claude AI | ✅ Yes | Week 3 |
| Skill tree (all 16 skills + XP) | ✅ Yes | Week 3 |
| Today's Focus (auto-generated) | ✅ Yes | Week 3 |
| Basic insights + weekly stats | ✅ Yes | Week 4 |
| Profile + basic achievements | ✅ Yes | Week 4 |
| Network monitoring (API cost) | ❌ No | Week 5-6 |
| File system analysis (project health) | ❌ No | Week 5-6 |
| Rich educational timeline cards | ❌ No | Week 5-6 |
| Windows build | ❌ No | Week 5-6 |
| iOS companion app | ❌ No | Week 7-10 |
| Guided onboarding | ❌ No | Week 7-10 |
| App Store submission | ❌ No | Week 10+ |

---

# Updated Cost Estimates

| Item | Cost | Phase |
| --- | --- | --- |
| Vercel Pro | $20/mo | Week 1+ |
| Domain | $12-30/yr | Week 1 |
| Resend (email) | Free tier (3k emails/mo) | Week 1+ |
| Claude API (Sonnet) | $50-100/mo | Week 3+ |
| Plausible Analytics | $9/mo | Week 1+ |
| Sentry (error tracking) | Free tier | Week 4+ |
| Apple Developer Account | $99/yr | Week 10+ |
| Supabase (sync, if needed) | Free tier → $25/mo | Week 7+ |
| **Total (first month)** | **~$80-130** |  |

---

# Key Decisions Made

1. **macOS first, Windows fast-follow.** Ship macOS in 4 weeks, add Windows in Week 5-6 with the same codebase.
2. **Tauri 2.0 over Electron.** 5MB binary vs 150MB. Native performance. Rust backend enables efficient process monitoring.
3. **Local-first architecture.** All user data stays on device. Cloud sync is opt-in for iOS companion only.
4. **Claude Sonnet for AI.** Balances cost, speed, and quality for chat + session analysis. Cheaper than Opus, smarter than Haiku.
5. **React Native for iOS.** Shares design language and component patterns with the desktop React frontend. Faster than building native Swift.
6. **Cut aggressively to ship in 4 weeks.** Network monitoring, project health analysis, and rich educational cards move to Week 5-6. The core loop (detect → track → learn → grow) ships on Day 30.
