import { NextRequest, NextResponse } from 'next/server'
import { runAnalystAgent } from '@/agents/analyst'
import { runGameEngineAgent, scoreToWaveParams } from '@/agents/gameEngine'
import { runGoalAgent } from '@/agents/goalAgent'
import { buildPlayerContext } from '@/agents/contextAgent'
import { createAuthClient } from '@/lib/supabase'
import { calculateScore } from '@/lib/utils'
import type { ParsedTxn, Period } from '@/lib/types'

export const maxDuration = 300

// Fixed demo date ranges — each period maps to real calendar dates so W1, W1½,
// and W2 transactions land in distinct (but overlapping) windows.
const PERIOD_DATES: Record<Period, string[]> = {
  week1:     ['2026-04-01','2026-04-02','2026-04-03','2026-04-04','2026-04-05','2026-04-06','2026-04-07'],
  week1half: ['2026-04-04','2026-04-05','2026-04-06','2026-04-07','2026-04-08','2026-04-09','2026-04-10'],
  week2:     ['2026-04-08','2026-04-09','2026-04-10','2026-04-11','2026-04-12','2026-04-13','2026-04-14'],
}

// The "week bucket" each period belongs to — W1 and W1½ are the same week.
const PERIOD_WEEK_START: Record<Period, string> = {
  week1:     '2026-04-01',
  week1half: '2026-04-01',
  week2:     '2026-04-08',
}

function assignDates(txns: ParsedTxn[], period: Period): (ParsedTxn & { transaction_date: string })[] {
  const dates = PERIOD_DATES[period]
  return txns.map((t, i) => ({ ...t, transaction_date: dates[i % dates.length] }))
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

    const weekStart  = PERIOD_WEEK_START[period]
    const weekNumber = period === 'week2' ? 2 : 1
    const isNewWeek  = period === 'week2'

    const dated      = assignDates(transactions, period)
    const periodDates = PERIOD_DATES[period]
    const rangeStart = periodDates[0]
    const rangeEnd   = periodDates[periodDates.length - 1]

    // Always clear NPC conversations so NPCs open fresh with new data
    await db.from('npc_conversations').delete().eq('user_id', userId)

    if (isNewWeek) {
      // Carry forward best result from the week just ended
      const { data: prevGs } = await db.from('game_state')
        .select('best_points_week, best_health_week')
        .eq('user_id', userId).maybeSingle()

      const carryPoints = prevGs?.best_points_week ?? 0
      const carryHealth = Math.max(prevGs?.best_health_week ?? 100, 50)

      // Close the real active W1 goal so it survives as history
      const { data: activeGoal } = await db.from('weekly_goals')
        .select('id')
        .eq('user_id', userId)
        .eq('completed', false)
        .maybeSingle()

      if (activeGoal) {
        await db.from('weekly_goals').update({ completed: true }).eq('id', activeGoal.id)
      }

      await Promise.all([
        db.from('transactions').delete().eq('user_id', userId)
          .gte('transaction_date', rangeStart).lte('transaction_date', rangeEnd),
        db.from('weekly_goals').delete().eq('user_id', userId).eq('completed', false),
      ])

      // Seed a placeholder only when there is zero real history (brand-new demo account)
      const { count: histCount } = await db.from('weekly_goals')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId).eq('completed', true)

      if (!histCount || histCount === 0) {
        await db.from('weekly_goals').insert({
          user_id: userId,
          week_start_date: '2026-04-01',
          goal_amount: 350,
          goal_category: 'food',
          goal_label: 'Keep food spend under $350 — Week 1 target',
          actual_spent: 287,
          score: 72,
          completed: true,
        })
      }

      await db.from('game_state').upsert({
        user_id: userId,
        points: carryPoints,
        city_health: carryHealth,
        week_number: weekNumber,
        level: 1,
        towers_placed: [],
        week_start_points: carryPoints,
        week_start_health: carryHealth,
        best_points_week: 0,
        best_health_week: 0,
        plays_this_week: 0,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

    } else {
      // Same week: date-range merge — only replace transactions that overlap
      await db.from('transactions').delete().eq('user_id', userId)
        .gte('transaction_date', rangeStart).lte('transaction_date', rangeEnd)

      const { data: existingGs } = await db.from('game_state')
        .select('user_id').eq('user_id', userId).maybeSingle()
      if (!existingGs) {
        await db.from('game_state').insert({
          user_id: userId,
          points: 0, city_health: 100, week_number: weekNumber,
          level: 1, towers_placed: [],
          week_start_points: 0, week_start_health: 100,
          best_points_week: 0, best_health_week: 0, plays_this_week: 0,
          updated_at: new Date().toISOString(),
        })
      }
    }

    // Insert new transactions
    await db.from('transactions').insert(dated.map(t => ({
      user_id: userId,
      ...t,
      category: (t.category ?? 'other').toLowerCase(),
    })))

    // Analyst scoped to this week's date range — W2 never sees W1 data
    const financialProfile = await runAnalystAgent(userId, token, weekStart)
    const playerHistory    = await buildPlayerContext(userId, token)

    // Look for an active goal in this week's bucket
    const { data: existingGoal } = await db.from('weekly_goals')
      .select('*')
      .eq('user_id', userId)
      .eq('completed', false)
      .eq('week_start_date', weekStart)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existingGoal) {
      // Mid-week upload: refresh progress from merged data, keep goal
      const cats        = financialProfile.categories as Record<string, number>
      const actualSpent = cats[existingGoal.goal_category] ?? 0
      const score       = calculateScore(
        actualSpent, existingGoal.goal_amount,
        financialProfile.total_spent, financialProfile.total_income,
      )
      await db.from('weekly_goals').update({ actual_spent: actualSpent, score }).eq('id', existingGoal.id)

      const params = scoreToWaveParams(score)
      await db.from('wave_config').upsert(
        { user_id: userId, week_number: weekNumber, financial_score: score, ...params },
        { onConflict: 'user_id,week_number' }
      )
    } else {
      // First upload of this week — goalAgent picks the category target
      const goalResult = await runGoalAgent({
        categories: financialProfile.categories as Record<string, number>,
        flaggedTransactions: financialProfile.flagged_transactions.map(t => ({
          merchant: t.merchant ?? 'Unknown',
          amount: Number(t.amount),
          flag_reason: t.flag_reason,
        })),
        totalSpent:  financialProfile.total_spent,
        totalIncome: financialProfile.total_income,
        excludedCategories: [],
        playerHistory,
      })

      const cats        = financialProfile.categories as Record<string, number>
      const actualSpent = cats[goalResult.goal_category] ?? 0
      const score       = calculateScore(
        actualSpent, goalResult.goal_amount,
        financialProfile.total_spent, financialProfile.total_income,
      )

      await db.from('weekly_goals').insert({
        user_id: userId,
        week_start_date: weekStart,
        goal_amount:   goalResult.goal_amount,
        goal_category: goalResult.goal_category,
        goal_label:    goalResult.goal_label,
        actual_spent:  actualSpent,
        score,
        completed: false,
      })

      await runGameEngineAgent(userId, score, weekNumber, token, { points: 0, health: 0 })

      const { data: freshGs } = await db.from('game_state')
        .select('points, city_health').eq('user_id', userId).single()
      await db.from('game_state').update({
        week_start_points: freshGs?.points      ?? 0,
        week_start_health: freshGs?.city_health ?? 100,
        best_points_week:  0,
        best_health_week:  0,
        plays_this_week:   0,
      }).eq('user_id', userId)
    }

    // W2: snapshot week_start after gameEngine ran
    if (isNewWeek) {
      const { data: freshGs } = await db.from('game_state')
        .select('points, city_health').eq('user_id', userId).single()
      await db.from('game_state').update({
        week_start_points: freshGs?.points      ?? 0,
        week_start_health: freshGs?.city_health ?? 100,
      }).eq('user_id', userId)
    }

    const { data: finalGoal } = await db.from('weekly_goals')
      .select('score').eq('user_id', userId).eq('completed', false)
      .order('created_at', { ascending: false }).limit(1).single()

    return NextResponse.json({ ok: true, score: finalGoal?.score ?? 0, weekNumber })
  } catch (err: any) {
    console.error('[confirm-statement]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
