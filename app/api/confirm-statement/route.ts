import { NextRequest, NextResponse } from 'next/server'
import { runAnalystAgent } from '@/agents/analyst'
import { scoreToWaveParams } from '@/agents/gameEngine'
import { createAuthClient } from '@/lib/supabase'
import { calculateScore } from '@/lib/utils'
import type { ParsedTxn, Period } from '@/lib/types'

export const maxDuration = 300

// Each period's tracking start is the date from which goal progress is measured.
// W1 and W1½ share the same tracking bucket (Apr 8) so W1½ updates the W1 goal.
// W2 starts a fresh tracking bucket (Apr 15).
const PERIOD_CONFIG: Record<Period, {
  trackingStart: string
  weekNumber:   number
  isNewGameWeek: boolean  // true → resets game state, closes prior goal
}> = {
  week1:     { trackingStart: '2026-04-08', weekNumber: 1, isNewGameWeek: true  },
  week1half: { trackingStart: '2026-04-08', weekNumber: 1, isNewGameWeek: false },
  week2:     { trackingStart: '2026-04-15', weekNumber: 2, isNewGameWeek: true  },
}

const PERIOD_FALLBACK: Record<Period, string> = {
  week1:     '2026-04-01',
  week1half: '2026-04-07',
  week2:     '2026-04-08',
}

async function trackingSpend(
  db: ReturnType<typeof createAuthClient>,
  userId: string,
  category: string,
  sinceDate: string,
): Promise<number> {
  const { data } = await db.from('transactions')
    .select('amount')
    .eq('user_id', userId)
    .eq('category', category)
    .gte('transaction_date', sinceDate)
  return (data ?? []).reduce((s: number, t: any) => s + Number(t.amount), 0)
}

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { userId, transactions, period } = await req.json() as {
      userId: string
      transactions: ParsedTxn[]
      period: Period
    }

    if (!userId || !transactions || !period)
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })

    const db = createAuthClient(token)
    const { trackingStart, weekNumber, isNewGameWeek } = PERIOD_CONFIG[period]
    const fallback = PERIOD_FALLBACK[period]

    const dated = transactions.map(t => ({
      ...t,
      category:         (t.category ?? 'other').toLowerCase(),
      transaction_date: t.transaction_date ?? fallback,
    }))

    const allDates   = dated.map(t => t.transaction_date).sort()
    const rangeStart = allDates[0]
    const rangeEnd   = allDates[allDates.length - 1]

    const { count: preExisting } = await db.from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('transaction_date', rangeStart)
      .lte('transaction_date', rangeEnd)

    // Always clear NPC conversations so every upload gets fresh context
    await db.from('npc_conversations').delete().eq('user_id', userId)
    if (isNewGameWeek) {
      await db.from('category_preferences').delete().eq('user_id', userId)
    }

    // Date-range merge: replace only what the incoming statement covers
    await db.from('transactions').delete().eq('user_id', userId)
      .gte('transaction_date', rangeStart).lte('transaction_date', rangeEnd)
    await db.from('transactions').insert(dated.map(t => ({ user_id: userId, ...t })))

    let needsGoalSelection = false

    // ── New game week (W1 or W2) ────────────────────────────────────────────
    if (isNewGameWeek) {
      const { data: prevGs } = await db.from('game_state')
        .select('best_points_week, best_health_week')
        .eq('user_id', userId).maybeSingle()

      const carryPoints = weekNumber > 1 ? (prevGs?.best_points_week ?? 0) : 0
      const carryHealth = weekNumber > 1 ? Math.max(prevGs?.best_health_week ?? 100, 50) : 100

      // Analyst scoped to this week's transactions — needed to close prior goal
      const financialProfile = await runAnalystAgent(userId, token, rangeStart)

      // Find and close any open goal from the previous game week
      const { data: prevGoal } = await db.from('weekly_goals')
        .select('id, goal_category, goal_amount, week_start_date')
        .eq('user_id', userId)
        .eq('completed', false)
        .maybeSingle()

      if (prevGoal?.goal_category && prevGoal.week_start_date) {
        const finalSpent = await trackingSpend(db, userId, prevGoal.goal_category, prevGoal.week_start_date)
        const finalScore = calculateScore(
          finalSpent, prevGoal.goal_amount,
          financialProfile.total_spent, financialProfile.total_income,
        )
        await db.from('weekly_goals')
          .update({ completed: true, actual_spent: finalSpent, score: finalScore })
          .eq('id', prevGoal.id)
      }

      // Belt-and-suspenders: clear any remaining incomplete goals
      await db.from('weekly_goals').delete().eq('user_id', userId).eq('completed', false)

      // Seed a placeholder so NPCs have context on first run
      const { count: histCount } = await db.from('weekly_goals')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId).eq('completed', true)

      if (!histCount || histCount === 0) {
        await db.from('weekly_goals').insert({
          user_id:         userId,
          week_start_date: '2026-04-08',
          goal_amount:     350,
          goal_category:   'food',
          goal_label:      'Keep food spend under $350 — Week 1 baseline',
          actual_spent:    287,
          score:           65,
          completed:       true,
        })
      }

      // Reset game state, carrying forward last week's best result
      await db.from('game_state').upsert({
        user_id:           userId,
        points:            carryPoints,
        city_health:       carryHealth,
        week_number:       weekNumber,
        level:             1,
        towers_placed:     [],
        week_start_points: carryPoints,
        week_start_health: carryHealth,
        best_points_week:  0,
        best_health_week:  0,
        plays_this_week:   0,
        updated_at:        new Date().toISOString(),
      }, { onConflict: 'user_id' })

      // User must now pick their own goal
      needsGoalSelection = true

    // ── Same game week (W1½) ────────────────────────────────────────────────
    } else {
      const { data: existingGs } = await db.from('game_state')
        .select('user_id').eq('user_id', userId).maybeSingle()
      if (!existingGs) {
        await db.from('game_state').insert({
          user_id: userId, points: 0, city_health: 100, week_number: weekNumber,
          level: 1, towers_placed: [], week_start_points: 0, week_start_health: 100,
          best_points_week: 0, best_health_week: 0, plays_this_week: 0,
          updated_at: new Date().toISOString(),
        })
      }

      const financialProfile = await runAnalystAgent(userId, token)

      const { data: existingGoal } = await db.from('weekly_goals')
        .select('*')
        .eq('user_id', userId)
        .eq('completed', false)
        .eq('week_start_date', trackingStart)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (existingGoal?.goal_category) {
        // Update mid-week progress
        const actualSpent = await trackingSpend(db, userId, existingGoal.goal_category, trackingStart)
        const score = calculateScore(
          actualSpent, existingGoal.goal_amount,
          financialProfile.total_spent, financialProfile.total_income,
        )
        await db.from('weekly_goals')
          .update({ actual_spent: actualSpent, score })
          .eq('id', existingGoal.id)

        const params = scoreToWaveParams(score)
        await db.from('wave_config').upsert(
          { user_id: userId, week_number: weekNumber, financial_score: score, ...params },
          { onConflict: 'user_id,week_number' }
        )
      } else {
        // W1½ uploaded with no prior W1 goal — user needs to pick one
        needsGoalSelection = true
      }
    }

    const { data: finalGoal } = await db.from('weekly_goals')
      .select('score').eq('user_id', userId).eq('completed', false)
      .order('created_at', { ascending: false }).limit(1).single()

    return NextResponse.json({
      ok:                true,
      score:             finalGoal?.score ?? 0,
      weekNumber,
      trackingStart,
      needsGoalSelection,
      preExisting:       preExisting ?? 0,
      inserted:          dated.length,
    })
  } catch (err: any) {
    console.error('[confirm-statement]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
