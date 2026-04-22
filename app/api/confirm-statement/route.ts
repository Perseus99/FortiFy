import { NextRequest, NextResponse } from 'next/server'
import { runAnalystAgent } from '@/agents/analyst'
import { runGameEngineAgent, scoreToWaveParams } from '@/agents/gameEngine'
import { runGoalAgent } from '@/agents/goalAgent'
import { buildPlayerContext } from '@/agents/contextAgent'
import { createAuthClient } from '@/lib/supabase'
import { isoWeekStart, addDays } from '@/lib/utils'
import type { ParsedTxn, Period } from '@/lib/types'

export const maxDuration = 300

// Spread transactions across the window for the given period (all within current week)
function assignDates(txns: ParsedTxn[], period: Period, currentMonday: string): (ParsedTxn & { transaction_date: string })[] {
  const dayCount = period === 'week1' ? 3 : 5
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

    const today          = new Date()
    const currentMonday  = isoWeekStart(today)
    const lastMonday     = addDays(currentMonday, -7)
    const weekNumber     = period === 'week2' ? 2 : 1
    const isNewWeek      = period === 'week2'

    // Assign dates and compute the date range this statement covers
    const dated = assignDates(transactions, period, currentMonday)
    const sortedDates = dated.map(t => t.transaction_date).sort()
    const rangeStart  = sortedDates[0]
    const rangeEnd    = sortedDates[sortedDates.length - 1]

    // Always clear NPC conversations — context has changed
    await db.from('npc_conversations').delete().eq('user_id', userId)

    if (isNewWeek) {
      // Week 2 = new game week: wipe all goals and reset game state from scratch
      await Promise.all([
        db.from('transactions').delete().eq('user_id', userId)
          .gte('transaction_date', rangeStart).lte('transaction_date', rangeEnd),
        db.from('weekly_goals').delete().eq('user_id', userId),
      ])
      await db.from('game_state').upsert(
        { user_id: userId, points: 0, city_health: 100, week_number: weekNumber, level: 1, towers_placed: [], updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )
      // Seed a completed Week 1 goal so NPCs have playerHistory to reference
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
    } else {
      // Same week (W1 or W1½): date-range merge — only replace transactions that overlap
      await db.from('transactions').delete().eq('user_id', userId)
        .gte('transaction_date', rangeStart).lte('transaction_date', rangeEnd)

      // Initialize game_state only if this is the very first upload
      const { data: existingGs } = await db.from('game_state')
        .select('user_id').eq('user_id', userId).maybeSingle()
      if (!existingGs) {
        await db.from('game_state').insert({
          user_id: userId, points: 0, city_health: 100, week_number: weekNumber,
          level: 1, towers_placed: [], updated_at: new Date().toISOString(),
        })
      }
    }

    // Insert new transactions with normalized categories
    await db.from('transactions').insert(dated.map(t => ({
      user_id: userId,
      ...t,
      category: (t.category ?? 'other').toLowerCase(),
    })))

    // Run analyst on ALL transactions now in the DB (post-merge view)
    const financialProfile = await runAnalystAgent(userId, 3000, token)
    const playerHistory    = await buildPlayerContext(userId, token)

    // Check if an active goal already exists for this week
    const { data: existingGoal } = await db.from('weekly_goals')
      .select('*')
      .eq('user_id', userId)
      .eq('completed', false)
      .gte('week_start_date', currentMonday)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existingGoal) {
      // Mid-week upload: keep the goal, refresh actual_spent and score from merged data
      const cats = financialProfile.categories as Record<string, number>
      const actualSpent = cats[existingGoal.goal_category] ?? 0
      await db.from('weekly_goals')
        .update({ actual_spent: actualSpent, score: financialProfile.score })
        .eq('id', existingGoal.id)

      // Update wave difficulty for the new score — but don't re-award points
      const params = scoreToWaveParams(financialProfile.score)
      await db.from('wave_config').upsert(
        { user_id: userId, week_number: weekNumber, financial_score: financialProfile.score, ...params },
        { onConflict: 'user_id,week_number' }
      )
    } else {
      // First upload of this week: run goal agent and award points via game engine
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

      const cats = financialProfile.categories as Record<string, number>
      await db.from('weekly_goals').insert({
        user_id: userId,
        week_start_date: currentMonday,
        goal_amount:   goalResult.goal_amount,
        goal_category: goalResult.goal_category,
        goal_label:    goalResult.goal_label,
        actual_spent:  cats[goalResult.goal_category] ?? 0,
        score:         financialProfile.score,
        completed:     false,
      })

      await runGameEngineAgent(userId, financialProfile.score, weekNumber, token, { points: 0, health: 0 })
    }

    return NextResponse.json({ ok: true, score: financialProfile.score, weekNumber })
  } catch (err: any) {
    console.error('[confirm-statement]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
