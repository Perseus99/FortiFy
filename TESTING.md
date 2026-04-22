# Testing FortiFi

A walkthrough for demoing and manually testing the app end-to-end.

---

## Prerequisites

- A Supabase project with the schema applied (`supabase/schema.sql`, `supabase/functions.sql`, `supabase/npc_conversations.sql`)
- `ANTHROPIC_API_KEY` and Supabase env vars set (`.env.local` locally, or Vercel env vars in production)
- `npm run dev` running locally, or use the live deployment at https://forti-fy.vercel.app

---

## 1. Create an account

1. Go to `/` → click **Get Started** → sign up with an email + password
2. Confirm your email if Supabase email confirmation is enabled
3. You land on `/dashboard` — you'll see the **Welcome to FortiFi** setup banner

---

## 2. Load data — two paths

### Path A: Statement Upload (recommended for demos)

This is the main demo path. It gives you control over the exact scenario.

1. Click **Upload Statement** in the top-right nav
2. In the modal, pick a **Demo Period**:
   - **Week 1** — high food + subscription spend; hard wave; NPCs react strongly
   - **Mid-Week** — same week but 4 days in; goal progress bar + projection line show clearly
   - **Week 2** — improved behavior; NPCs reference Week 1 history (memory demo)
3. Download the matching sample: click **↓ Week 1** (or W1½ / W2) — saves a `.txt` file
4. Click the upload area and select that `.txt` file
5. Wait ~10–15 s for Claude to parse — a transaction preview appears
6. Review the parsed transactions, then click **Apply [Period] Statement**
7. Wait ~20–30 s for the agent pipeline (analyst + goal + game engine) to run
8. The page reloads with score, city HP, wave difficulty, and the active goal set

### Path B: Seed data (quick fallback)

1. On the dashboard, click **Set Up Account** in the welcome banner
2. Waits ~30 s — seeds deterministic transactions and runs the weekly loop
3. Use this if you want a known baseline without uploading a file

---

## 3. Explore the dashboard

| Element | What to check |
|---------|---------------|
| **Stats row** | Points, City HP, Week Score (letter grade S/A/B/C/D) |
| **Weekly Goal** | Category, target amount, progress bar, projection marker, reward tiers |
| **Spending Breakdown** | Top-5 categories by spend |
| **Transactions list** | Flagged items in red; date and category shown |
| **NPC cards** | Warden glows red if over budget; Scout glows teal if flagged txns exist |

---

## 4. Talk to the NPCs

Each NPC has a distinct persona — open them in order to see the contrast:

1. **The Warden** (⚔️) — ask "how am I doing?" — will be harsh if over budget
2. **The Scout** (🔍) — ask "what did you find?" — calls out flagged merchants by name
3. **The Architect** (📐) — ask "what's my savings plan?" — income-allocation focused
4. **The Quartermaster** (📦) — ask "audit my categories" — 50/30/20 breakdown

**Memory test (Week 2 scenario):**
- Upload the Week 2 sample, then open the Warden or Scout
- They should acknowledge "last week's food spending" and the improvement
- Close and reopen the dialog — messages persist (no re-fetch from DB)

---

## 5. Play the game

1. Click **Play This Week** — loads the Phaser tower defense scene
2. Wave difficulty is set by your financial score:
   - Score ≥ 80 → easy wave + bonus tower
   - Score 50–79 → medium wave
   - Score < 50 → hard wave, city starts pre-damaged
3. Complete the wave → return to dashboard → click **Sync Data** to record the result

---

## 6. Demo scenario sequence (for presentations)

**Recommended order for a 5-minute demo:**

1. Upload **Week 1** statement → show high spend, hard wave, Warden/Scout alerts
2. Open Warden → get the budget lecture; open Scout → see flagged Uber Eats / subscription stack
3. Play the game (hard wave)
4. Upload **Week 2** statement → show improved spend, easier wave
5. Open any NPC → demonstrate they remember Week 1 ("last week you spent $443 on food...")
6. Show the goal progress bar with the projection marker

---

## 7. Key things to verify after any code change

- [ ] Upload a `.txt` sample → transactions parsed correctly, no 422 error
- [ ] Confirm → page reloads with score, goal, and wave_config populated
- [ ] NPC dialog opens, responds in character, and history persists on re-open
- [ ] Week score shows `—` when no sync has run (not 0)
- [ ] Goal progress bar + projection marker visible mid-week
- [ ] Dismiss goal ("this spend is intentional") triggers a new goal
- [ ] City HP = 0 banner appears when health hits zero
