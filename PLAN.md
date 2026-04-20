# FortifyFi — Build Plan
> 3-day course project. Mark blocks with [x] when done, cross off with ~~text~~ if scrapped.

---

## Branding
- **Product name:** FortifyFi
- **Concept:** Tower defense game where your financial discipline = your defenses

---

## Stack
- **Frontend:** React + Next.js 14 (App Router)
- **Game Engine:** Phaser.js
- **Backend/DB:** Supabase (auth + database + real-time)
- **AI:** Local LLM via Ollama (free, no API costs — model: `qwen2.5:7b`)
- **Bank Data:** Nessie API (Capital One hackathon sandbox — synthetic data)
- **Deployment:** Vercel

---

## Game Design

### Towers
All towers are unlocked/upgraded using points earned from good financial behavior.

| Tower | Financial Concept | Mechanic |
|-------|------------------|----------|
| **Archer Tower** | Basic budgeting | Fast attack, low damage — consistent spending control |
| **Cannon Tower** | Lump sum saving | Slow, high damage — big savings hits hard |
| **Frost Tower** | Debt freeze | Slows enemies — represents freezing unnecessary spending |
| **Mortar Tower** | Investment returns | Area of effect — money working for you, hits multiple targets |
| **Wall** | Emergency fund | Passive blocker — absorbs hits before enemies reach city |

> **MVP towers (Day 2):** Archer Tower + Cannon Tower only. Frost, Mortar, Wall = v2.

---

### NPCs
Each NPC is a local LLM call with a distinct character system prompt. They appear proactively at trigger points and are always clickable for more advice.

| NPC | Archetype | Financial Role | Trigger |
|-----|-----------|---------------|---------|
| **The Warden** | Strict enforcer | Calls out overspending hard, no sugar coating | Budget exceeded |
| **The Scout** | Recon specialist | Spots hidden/recurring charges you forgot about | Subscription/recurring charge detected |
| **The Alchemist** | Wise sage | Long-term strategy, turns bad habits into insights | Week start review |
| **The Merchant** | Shrewd trader | Spending pattern analysis, deal-spotting | Shopping category spikes |
| **The Oracle** | Mysterious seer | Predicts next week's risk based on trends | End of week summary |

> **MVP NPCs (Day 3):** The Warden + The Scout only. Others = v2.

---

### Enemies
Wave difficulty is set by the Game Engine Agent based on weekly financial score.

| Score | Wave Type | Description |
|-------|-----------|-------------|
| 80–100 | Easy | Small, slow enemies — good week, light pressure |
| 50–79 | Medium | Mixed fast/slow enemies |
| 0–49 | Hard | Fast swarms + tanky units, city starts slightly damaged |

> Enemy types are generic sprites for MVP. Named enemies (e.g. "Impulse Spender", "Subscription Creep") = v2.

---

### Core Game Loop
```
Every week:
1. Nessie sync → transactions pulled
2. Analyst Agent → categorize + score (0–100)
3. Game Engine Agent → configure enemy wave based on score
4. User plays tower defense session
5. End of game → points saved, NPC triggered, city state updated
```

---

## Agent Architecture

### Agent 1 — Financial Analyst Agent
**Trigger:** Weekly sync  
**Tools:**
- `get_transactions(account_id, date_range)` — Nessie API
- `categorize_spending(transactions)` — groups into food, subscriptions, shopping, etc.
- `calculate_score(spending_vs_goal)` — returns 0–100
- `detect_patterns(transactions)` — recurring charges, risky habits, savings streaks

**Output:** Structured financial profile → written to Supabase

---

### Agent 2 — Game Engine Agent
**Trigger:** After Analyst Agent completes  
**Tools:**
- `get_financial_profile(user_id)` — reads from Supabase
- `generate_wave_config(score)` — returns enemy count, speed, HP, spawn rate
- `apply_rewards(score)` — unlocks towers/upgrades
- `write_game_config(user_id, config)` — writes wave params to Supabase

---

### Agent 3 — NPC Agent *(v2)*
**Trigger:** Proactive (budget exceeded, week start, subscription detected) or user click  
**Tools:**
- `get_financial_profile(user_id)`
- `get_flagged_transactions(user_id)`
- `generate_npc_dialogue(npc_character, context)` — LLM call with character system prompt

---

### Agent 4 — Goal Setting Agent *(v2)*
**Trigger:** Week start  
**Tools:**
- `analyze_history(user_id, past_weeks)`
- `suggest_goal(profile, history)` — personalized weekly savings target
- `validate_goal(user_input)` — checks if user-set goal is realistic

---

## Supabase Schema

```
users           — id, email, created_at (linked to Supabase auth)
game_state      — user_id, points, city_health, week_number, towers_placed, level
weekly_goals    — user_id, goal_amount, actual_spent, score, week_start_date
transactions    — user_id, nessie_id, amount, category, merchant, date, flagged
wave_config     — user_id, week_number, enemy_count, enemy_speed, enemy_hp, spawn_rate
```

---

## Before Day 1 — You Do This (~30 min)
- [ ] Nessie API key → register at `api.nessieisreal.com`
- [ ] Supabase project → `supabase.com` (free tier, grab URL + anon key)
- [x] Install Ollama → `ollama.com`, then run: `ollama pull qwen2.5:7b` ✓
- [ ] Vercel account linked to GitHub

---

## Day 1 — Foundation & Data Layer

### Block 1 — Project Scaffolding (~2 hrs) ✓
- [x] Next.js 14 app with App Router
- [x] Install deps: `phaser`, `@supabase/supabase-js`, `tailwindcss`, `ollama`
- [x] Folder structure + env setup + Supabase client config
- [x] Basic auth pages (login/signup)

> **Blocker:** Paste Nessie key + Supabase URL/anon key into `.env.local`

---

### Block 2 — Supabase Schema (~2 hrs) ✓
- [x] Create all 5 tables (users, game_state, weekly_goals, transactions, wave_config)
- [x] Row-level security policies on all tables
- [x] Test: confirm tables visible in Supabase dashboard

---

### Block 3 — Nessie Integration + Analyst Agent (~3 hrs) ✓
- [x] Nessie API wrapper (fetch accounts + transactions)
- [x] Data seeding script (creates realistic fake spending profile in Nessie)
- [x] **Financial Analyst Agent** (Ollama):
  - Pulls transactions from Nessie
  - Categorizes spending
  - Calculates weekly score (0–100)
  - Writes results to Supabase
- [x] Game Engine Agent (score → wave config)
- [x] API routes: /api/seed and /api/weekly-loop
- [ ] Test: run agent, confirm score + transactions appear in DB

---

## Day 2 — The Game

### Block 4 — Phaser.js Setup in Next.js (~3 hrs) ✓
- [x] Phaser dynamic import (avoids SSR crash — used `import * as Phaser` fix for ESM)
- [x] Game canvas component embedded in Next.js page
- [x] 1 map: top-down grid with S-curve path for enemies
- [x] Archer Tower + Cannon Tower placeable on grid click
- [x] Tower placement costs points, hover highlight shows affordability
- [x] Tower range visible on hover

> **You test:** Does the map render? Can you place towers? Report visual bugs back.

---

### Block 5 — Enemy Waves & Combat (~3 hrs) ✓
- [x] Enemy sprites moving along path
- [x] Wave spawner reads config from Supabase (set by Game Engine Agent)
- [x] Tower attack logic (range detection, projectiles, enemy HP)
- [x] City HP bar (depletes when enemies reach end)
- [x] Win/lose condition per wave
- [x] End-of-wave: save result + points to Supabase

---

### Block 6 — Game Engine Agent (~2 hrs) ✓
- [x] Agent reads financial score from Supabase
- [x] Generates wave config:
  - Score 80–100 → easy wave + bonus tower unlocked
  - Score 50–79 → medium wave
  - Score 0–49 → hard wave, city starts slightly damaged
- [x] Writes wave_config to Supabase before game session

---

## Day 3 — NPCs, Dashboard & Ship

### Block 7 — NPC System (~2 hrs) ✓
- [x] **The Warden** — triggers when budget exceeded, harsh tone, flags overspending
- [x] **The Scout** — triggers when recurring/subscription charge detected, investigative tone
- [x] Each NPC = Ollama call with character system prompt + financial context
- [x] NPC popup React component (proactive triggers + always clickable)
- [x] Conversation stays in-context per session (full message history passed each turn)

---

### Block 8 — Dashboard UI (~2 hrs) ✓
- [x] Main dashboard: weekly score, spending breakdown by category, goal progress bar
- [x] "Play This Week" button → launches Phaser game
- [x] Transaction list with Scout-flagged items highlighted
- [x] Points + city health display

---

### Block 9 — Weekly Loop + Wire Everything (~2 hrs) ✓
- [x] Orchestrator function `runWeeklyLoop(userId)`:
  1. Nessie sync
  2. Analyst Agent runs → score to Supabase
  3. Game Engine Agent → wave config to Supabase
  4. Game session unlocked for user
- [x] End-of-game handler: saves result, updates points + city health, triggers NPC
- [x] Manual trigger button for now (cron = v2)

---

### Block 10 — Deploy (~1 hr)
- [x] Push to GitHub
- [x] Vercel deploy + add all env vars in Vercel dashboard
- [x] Smoke test production build

---

## Risk Register

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Phaser SSR crash in Next.js | High | Dynamic import fix, handled in Block 4 |
| Game balance feels off | Medium | Playtest + report back, I tune numbers |
| Local LLM response quality | Medium | Prompt engineering, fallback to rule-based if needed |
| Nessie API flakiness | Low-Med | Local mock data fallback |
| Visual polish lacking | High | Functional first, polish if time allows |

---

## MVP Scope (locked)
- 2 towers: Archer + Cannon
- 2 NPCs: The Warden + The Scout
- 2 agents: Analyst + Game Engine
- 1 map, wave difficulty tied to weekly score
- Nessie synthetic data only, no real banking

---

## V2 Features (post-submission)
- [ ] Goal Setting Agent
- [ ] 3 more NPCs: The Alchemist, The Merchant, The Oracle
- [ ] 3 more towers: Frost Tower, Mortar Tower, Wall
- [ ] Named enemies (Impulse Spender, Subscription Creep, etc.)
- [ ] Weekly boss battles tied to savings streaks
- [ ] Real banking API (Plaid)
- [ ] Weekly leaderboards + friend challenges
- [ ] Cron-based weekly loop (no manual trigger)
