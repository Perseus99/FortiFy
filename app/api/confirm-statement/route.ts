import { NextRequest, NextResponse } from 'next/server'
import { runAnalystAgent } from '@/agents/analyst'
import { runGameEngineAgent } from '@/agents/gameEngine'
import { runGoalAgent } from '@/agents/goalAgent'
import { buildPlayerContext } from '@/agents/contextAgent'
import { createAuthClient } from '@/lib/supabase'
import { isoWeekStart, addDays } from '@/lib/utils'
import type { ParsedTxn, Period } from '@/lib/types'

export const maxDuration = 300

// Spread transactions across the window for the given period (all within current week)
function assignDates(txns: ParsedTxn[], period: Period, currentMonday: string): (ParsedTxn & { transaction_date: string })[] {
  const dayCount = period === 'week1' ? 3 : 5  // week1=days 0-2, week1half=days 0-4, week2=days 0-4
  return txns.map((t, i) => ({
    ...t,
    transaction_date: addDays(currentMonday, i % dayCount),
  }))
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

    const today     = new Date()
    const currentMonday = isoWeekStart(today)
    const lastMonday    = addDays(currentMonday, -7)

    // Clear existing transactions and goals — preserve npc_conversations (NPC memory) and game_state
    await Promise.all([
      db.from('transactions').delete().eq('user_id', userId),
      db.from('weekly_goals').delete().eq('user_id', userId),
    ])

    // Reset game_state to a clean base so gameEngine delta starts fresh
    const weekNumber = period === 'week2' ? 2 : 1
    await db.from('game_state').upsert(
      { user_id: userId, points: 0, city_health: 100, week_number: weekNumber, level: 1, towers_placed: [], updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )

    // For week2: insert a completed Week 1 goal so NPCs have playerHistory to reference
    if (period === 'week2') {
      await db.from('weekly_goals').insert({
        user_id: userId,
        week_start_date: lastMonday,
        goal_amount: 350,
        goal_category: 'food',
        goal_label: 'Keep food spend under $350 — Week 1 target',
        actual_spent: 287,
        score: 72,
        completed: true,
      })
    }

    // Insert transactions with dates assigned to current week
    const dated = assignDates(transactions, period, currentMonday)
    await db.from('transactions').insert(dated.map(t => ({
      user_id: userId,
      ...t,
      category: (t.category ?? 'other').toLowerCase(),
    })))

    // Run analyst on the newly inserted transactions
    const financialProfile = await runAnalystAgent(userId, 3000, token)

    // Build player context (includes Week 1 history for week2)
    const playerHistory = await buildPlayerContext(userId, token)

    // Category totals for goal agent
    const catTotals: Record<string, number> = {}
    dated.filter(t => t.category !== 'income').forEach(t => {
      catTotals[t.category] = (catTotals[t.category] ?? 0) + t.amount
    })

    // Run goal agent to pick the active goal for this week
    const goalResult = await runGoalAgent({
      categories: catTotals,
      flaggedTransactions: financialProfile.flagged_transactions.map(t => ({
        merchant: t.merchant ?? 'Unknown',
        amount: Number(t.amount),
        flag_reason: t.flag_reason,
      })),
      totalSpent: financialProfile.total_spent,
      totalIncome: financialProfile.total_income,
      excludedCategories: [],
      playerHistory,
    })

    // Insert active goal for current week
    await db.from('weekly_goals').insert({
      user_id: userId,
      week_start_date: currentMonday,
      goal_amount: goalResult.goal_amount,
      goal_category: goalResult.goal_category,
      goal_label: goalResult.goal_label,
      actual_spent: 0,
      score: financialProfile.score,
      completed: false,
    })

    // Run game engine: sets wave_config and updates game_state
    await runGameEngineAgent(userId, financialProfile.score, weekNumber, token, { points: 0, health: 0 })

    return NextResponse.json({ ok: true, score: financialProfile.score, weekNumber })
  } catch (err: any) {
    console.error('[confirm-statement]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
