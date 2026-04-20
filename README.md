# FortifyFi

A tower defense game where your real spending habits determine how hard the enemy waves hit. Save more, defend better.

**Live app:** https://forti-fy.vercel.app

---

## How it works

1. **Connect your account** — synthetic bank data is generated via the Capital One Nessie API
2. **AI analysis** — Claude Haiku categorizes your spending and calculates a weekly financial score (0–100)
3. **Goal Agent** — identifies your riskiest spending category and sets a targeted reduction goal
4. **Play the game** — your score sets the enemy wave difficulty. Good spending = easy wave. Overspending = relentless horde
5. **NPC advisors** — The Warden and The Scout debrief you after each battle with personalized feedback

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend + API | Next.js 16 (App Router) |
| Game engine | Phaser 3 |
| Database + Auth | Supabase (Postgres + RLS) |
| AI agents | Claude Haiku via Anthropic SDK |
| Bank data | Capital One Nessie API (sandbox) |
| Deployment | Vercel (auto-deploy from `main`) |

---

## Agent architecture

| Agent | File | LLM | Purpose |
|---|---|---|---|
| Analyst | `agents/analyst.ts` | Yes | Categorizes transactions, calculates financial score |
| Game Engine | `agents/gameEngine.ts` | No | Converts score → wave difficulty |
| Goal Agent | `agents/goalAgent.ts` | Yes | Picks riskiest spending category, sets weekly target |
| Warden | `agents/warden.ts` | Yes | NPC — budget enforcer |
| Scout | `agents/scout.ts` | Yes | NPC — flags suspicious/recurring transactions |

---

## Game mechanics

### Towers
| Tower | Cost | Damage | Speed | Special |
|---|---|---|---|---|
| Archer | 50 pts | 20 | Fast | — |
| Cannon | 120 pts | 60 | Slow | Splash damage |

### Enemy types
| Enemy | HP | Speed | City damage |
|---|---|---|---|
| Foodie | Low | Normal | 15 |
| Impulse Buyer | Very low | Fast | 10 |
| Subscription Creep | High | Slow | 25 |
| Night Owl | Medium | Fast | 15 |
| Debt Collector | Very high | Slow | 35 |

### Wave difficulty
| Financial score | Enemies | Speed multiplier |
|---|---|---|
| 80–100 | 8 | 0.8× |
| 50–79 | 14 | 1.2× |
| 0–49 | 20 | 1.6× |

### Goal rewards
| Outcome | Effect |
|---|---|
| Hit goal (under target) | +50–75 pts, +5–10 HP |
| Close miss (within 20%) | No change |
| Missed by 20–50% | −10 HP |
| Missed by 50%+ | −20 HP |

---

## Project structure

```
agents/               AI agent logic
app/
  api/
    feedback/         Goal dismissal + recalculation
    npc/              NPC chat endpoint
    seed/             Nessie account seeding
    weekly-loop/      Main sync pipeline
  dashboard/          Dashboard page
  game/               Game page
  login/ signup/      Auth
components/
  game/               Phaser scene + React canvas wrapper
  npc/                NPC popup chat UI
lib/
  nessie.ts           Nessie API client
  ollama.ts           Claude API wrapper
  seed.ts             Transaction seeder
  supabase.ts         Supabase clients
  types.ts            Shared TypeScript types
supabase/
  schema.sql          DB tables + RLS policies
  functions.sql       Postgres RPC functions
```

---

## Contributing

See `CONTRIBUTING.md` for local setup, environment variables, and how to make changes.
