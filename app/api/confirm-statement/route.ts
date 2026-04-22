import { NextRequest, NextResponse } from 'next/server'
import { runAnalystAgent } from '@/agents/analyst'
import { runGameEngineAgent, scoreToWaveParams } from '@/agents/gameEngine'
import { runGoalAgent } from '@/agents/goalAgent'
import { buildPlayerContext } from '@/agents/contextAgent'
import { createAuthClient } from '@/lib/supabase'
import { calculateScore } from '@/lib/utils'
import type { ParsedTxn, Period } from '@/lib/types'

export const maxDuration = 300

// Each period's tracking start is the date from which goal progress is measured.
// W1 and W1½ share the same tracking bucket (Apr 8) so W1½ updates the W1 goal.
// W2 starts a fresh tracking bucket (Apr 15).
const PERIOD_CONFIG: Record<Period, {
  trackingStart: string   // goal tracks spending from this date onward
  weekNumber:   number
  isNewGameWeek: boolean  // true → resets game state, closes prior goal
}> = {
  week1:     { trackingStart: '2026-04-08', weekNumber: 1, isNewGameWeek: true  },
  week1half: { trackingStart: '2026-04-08', weekNumber: 1, isNewGameWeek: false },
  week2:     { trackingStart: '2026-04-15', weekNumber: 2, isNewGameWeek: true  },
}

// Fallback date if Claude fails to parse a transaction_date
const PERIOD_FALLBACK: Record<Period, string> = {
  week1:     '2026-04-01',
  week1half: '2026-04-07',
  week2:     '2026-04-08',
}

// Sum of a specific category from a given date onwards
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

    // Normalise transactions — use Claude-parsed date, fall back to period default
    const dated = transactions.map(t => ({
      ...t,
      category:         (t.category ?? 'other').toLowerCase(),
      transaction_date: t.transaction_date ?? fallback,
    }))

    const allDates  = dated.map(t => t.transaction_date).sort()
    const rangeStart = allDates[0]
    const rangeEnd   = allDates[allDates.length - 1]

    // Count transactions already in DB for this date range (reported back to UI)
    const { count: preExisting } = await db.from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('transaction_date', rangeStart)
      .lte('transaction_date', rangeEnd)

    // Always clear NPC conversations so every upload gets fresh context
    await db.from('npc_conversations').delete().eq('user_id', userId)
    // Reset skip-preferences at the start of each new game week
    if (isNewGameWeek) {
      await db.from('category_preferences').delete().eq('user_id', userId)
    }

    // Date-range merge: replace only what the incoming statement covers
    await db.from('transactions').delete().eq('user_id', userId)
      .gte('transaction_date', rangeStart).lte('transaction_date', rangeEnd)
    await db.from('transactions').insert(dated.map(t => ({ user_id: userId, ...t })))

    // ── New game week (W1 or W2) ────────────────────────────────────────────
    if (isNewGameWeek) {
      const { data: prevGs } = await db.from('game_state')
        .select('best_points_week, best_health_week')
        .eq('user_id', userId).maybeSingle()

      // W2 carries forward W1's best; W1 starts fresh
      const carryPoints = weekNumber > 1 ? (prevGs?.best_points_week ?? 0) : 0
      const carryHealth = weekNumber > 1 ? Math.max(prevGs?.best_health_week ?? 100, 50) : 100

      // Analyst scoped to this week's transactions only
      const financialProfile = await runAnalystAgent(userId, token, rangeStart)

      // Find and close any open goal from the previous game week
      const { data: prevGoal } = await db.from('weekly_goals')
        .select('id, goal_category, goal_amount, week_start_date')
        .eq('user_id', userId)
        .eq('completed', false)
        .maybeSingle()

      if (prevGoal?.goal_category && prevGoal.week_start_date) {
        // Final actual_spent = everything in the tracking period (now includes new data)
        const finalSpent = await trackingSpend(db, userId, prevGoal.goal_category, prevGoal.week_start_date)
        const finalScore = calculateScore(
          finalSpent, prevGoal.goal_amount,
          financialProfile.total_spent, financialProfile.total_income,
        )
        await db.from('weekly_goals')
          .update({ completed: true, actual_spent: finalSpent, score: finalScore })
          .eq('id', prevGoal.id)
      }

      // Delete any remaining incomplete goals (shouldn't be any, belt-and-suspenders)
      await db.from('weekly_goals').delete().eq('user_id', userId).eq('completed', false)

      // If no real completed history, seed a placeholder so NPCs have context
      const { count: histCount } = await db.from('weekly_goals')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId).eq('completed', true)

      if (!histCount || histCount === 0) {
        await db.from('weekly_goals').insert({
          user_id:        userId,
          week_start_date: '2026-04-08',
          goal_amount:    350,
          goal_category:  'food',
          goal_label:     'Keep food spend under $350 — Week 1 baseline',
          actual_spent:   287,
          score:          65,
          completed:      true,
        })
      }

      // Reset game state, carrying forward last week's best result
      await db.from('game_state').upsert({
        user_id:          userId,
        points:           carryPoints,
        city_health:      carryHealth,
        week_number:      weekNumber,
        level:            1,
        towers_placed:    [],
        week_start_points: carryPoints,
        week_start_health: carryHealth,
        best_points_week: 0,
        best_health_week: 0,
        plays_this_week:  0,
        updated_at:       new Date().toISOString(),
      }, { onConflict: 'user_id' })

      // Player history now includes the just-closed prev goal
      const playerHistory = await buildPlayerContext(userId, token)

      // Goal agent picks this week's forward-looking challenge
      const goalResult = await runGoalAgent({
        categories:          financialProfile.categories as Record<string, number>,
        flaggedTransactions: financialProfile.flagged_transactions.map(t => ({
          merchant:    t.merchant ?? 'Unknown',
          amount:      Number(t.amount),
          flag_reason: t.flag_reason,
        })),
        totalSpent:          financialProfile.total_spent,
        totalIncome:         financialProfile.total_income,
        excludedCategories:  [],
        playerHistory,
      })

      // Wave difficulty reflects this week's financial health (analysis period)
      const waveScore = calculateScore(
        (financialProfile.categories as Record<string, number>)[goalResult.goal_category] ?? 0,
        goalResult.goal_amount,
        financialProfile.total_spent,
        financialProfile.total_income,
      )

      // Insert goal — tracking starts from trackingStart, nothing spent yet → 0
      await db.from('weekly_goals').insert({
        user_id:         userId,
        week_start_date: trackingStart,
        goal_amount:     goalResult.goal_amount,
        goal_category:   goalResult.goal_category,
        goal_label:      goalResult.goal_label,
        actual_spent:    0,
        score:           0,
        completed:       false,
      })

      await runGameEngineAgent(userId, waveScore, weekNumber, token, { points: 0, health: 0 })

      // Snapshot week_start after gameEngine awarded points
      const { data: freshGs } = await db.from('game_state')
        .select('points, city_health').eq('user_id', userId).single()
      await db.from('game_state').update({
        week_start_points: freshGs?.points      ?? 0,
        week_start_health: freshGs?.city_health ?? 100,
      }).eq('user_id', userId)

    // ── Same game week (W1½) ────────────────────────────────────────────────
    } else {
      // Init game_state only if this is the very first upload ever
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

      // Analyst sees ALL data for this game week (no sinceDate — W1 + W1½ combined)
      const financialProfile = await runAnalystAgent(userId, token)

      // Find the active goal for this tracking bucket
      const { data: existingGoal } = await db.from('weekly_goals')
        .select('*')
        .eq('user_id', userId)
        .eq('completed', false)
        .eq('week_start_date', trackingStart)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (existingGoal?.goal_category) {
        // Update progress: count only tracking-period spend
        const actualSpent = await trackingSpend(db, userId, existingGoal.goal_category, trackingStart)
        const score = calculateScore(
          actualSpent, existingGoal.goal_amount,
          financialProfile.total_spent, financialProfile.total_income,
        )
        await db.from('weekly_goals')
          .update({ actual_spent: actualSpent, score })
          .eq('id', existingGoal.id)

        // Update wave difficulty based on goal progress
        const params = scoreToWaveParams(score)
        await db.from('wave_config').upsert(
          { user_id: userId, week_number: weekNumber, financial_score: score, ...params },
          { onConflict: 'user_id,week_number' }
        )
      } else {
        // W1½ uploaded without a prior W1 — create the goal fresh
        const playerHistory = await buildPlayerContext(userId, token)
        const goalResult = await runGoalAgent({
          categories:          financialProfile.categories as Record<string, number>,
          flaggedTransactions: financialProfile.flagged_transactions.map(t => ({
            merchant: t.merchant ?? 'Unknown', amount: Number(t.amount), flag_reason: t.flag_reason,
          })),
          totalSpent: financialProfile.total_spent, totalIncome: financialProfile.total_income,
          excludedCategories: [], playerHistory,
        })
        const waveScore = calculateScore(
          (financialProfile.categories as Record<string, number>)[goalResult.goal_category] ?? 0,
          goalResult.goal_amount, financialProfile.total_spent, financialProfile.total_income,
        )
        await db.from('weekly_goals').insert({
          user_id: userId, week_start_date: trackingStart,
          goal_amount: goalResult.goal_amount, goal_category: goalResult.goal_category,
          goal_label: goalResult.goal_label, actual_spent: 0, score: 0, completed: false,
        })
        await runGameEngineAgent(userId, waveScore, weekNumber, token, { points: 0, health: 0 })
        const { data: freshGs } = await db.from('game_state')
          .select('points, city_health').eq('user_id', userId).single()
        await db.from('game_state').update({
          week_start_points: freshGs?.points ?? 0, week_start_health: freshGs?.city_health ?? 100,
          best_points_week: 0, best_health_week: 0, plays_this_week: 0,
        }).eq('user_id', userId)
      }
    }

    const { data: finalGoal } = await db.from('weekly_goals')
      .select('score').eq('user_id', userId).eq('completed', false)
      .order('created_at', { ascending: false }).limit(1).single()

    return NextResponse.json({
      ok:          true,
      score:       finalGoal?.score ?? 0,
      weekNumber,
      preExisting: preExisting ?? 0,
      inserted:    dated.length,
    })
  } catch (err: any) {
    console.error('[confirm-statement]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
