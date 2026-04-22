import { NextRequest, NextResponse } from 'next/server'
import { runAnalystAgent } from '@/agents/analyst'
import { runGameEngineAgent, scoreToWaveParams } from '@/agents/gameEngine'
import { runGoalAgent } from '@/agents/goalAgent'
import { buildPlayerContext } from '@/agents/contextAgent'
import { createAuthClient } from '@/lib/supabase'
import { isoWeekStart, addDays, calculateScore } from '@/lib/utils'
import type { ParsedTxn, Period } from '@/lib/types'

export const maxDuration = 300

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

    const today         = new Date()
    const currentMonday = isoWeekStart(today)
    const lastMonday    = addDays(currentMonday, -7)
    const weekNumber    = period === 'week2' ? 2 : 1
    const isNewWeek     = period === 'week2'

    const dated       = assignDates(transactions, period, currentMonday)
    const sortedDates = dated.map(t => t.transaction_date).sort()
    const rangeStart  = sortedDates[0]
    const rangeEnd    = sortedDates[sortedDates.length - 1]

    // Always clear NPC conversations so NPCs open fresh with new data
    await db.from('npc_conversations').delete().eq('user_id', userId)

    if (isNewWeek) {
      // Read best from the week just ended to carry it forward
      const { data: prevGs } = await db.from('game_state')
        .select('best_points_week, best_health_week')
        .eq('user_id', userId).maybeSingle()

      const carryPoints = prevGs?.best_points_week ?? 0
      const carryHealth = Math.max(prevGs?.best_health_week ?? 100, 50)

      // Close out the real active goal from last week before wiping it
      const { data: activeGoal } = await db.from('weekly_goals')
        .select('id, goal_category, goal_amount, actual_spent, score')
        .eq('user_id', userId)
        .eq('completed', false)
        .maybeSingle()

      if (activeGoal) {
        await db.from('weekly_goals')
          .update({ completed: true })
          .eq('id', activeGoal.id)
      }

      await Promise.all([
        // Only wipe transactions in the incoming W2 date range
        db.from('transactions').delete().eq('user_id', userId)
          .gte('transaction_date', rangeStart).lte('transaction_date', rangeEnd),
        // Only wipe any remaining incomplete goals — keep completed history
        db.from('weekly_goals').delete().eq('user_id', userId).eq('completed', false),
      ])

      // If no real completed history exists (e.g. fresh demo), seed a placeholder
      const { count: histCount } = await db.from('weekly_goals')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('completed', true)

      if (!histCount || histCount === 0) {
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

      // Reset game state, carrying forward last week's best result as the new baseline
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

      // Initialize game_state only if this is the very first upload ever
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

    // Insert new transactions with normalized categories
    await db.from('transactions').insert(dated.map(t => ({
      user_id: userId,
      ...t,
      category: (t.category ?? 'other').toLowerCase(),
    })))

    // Pass 1: analyst gets financial data from all transactions now in DB
    const financialProfile = await runAnalystAgent(userId, token)
    const playerHistory    = await buildPlayerContext(userId, token)

    // Check for existing active goal this week
    const { data: existingGoal } = await db.from('weekly_goals')
      .select('*')
      .eq('user_id', userId)
      .eq('completed', false)
      .gte('week_start_date', currentMonday)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existingGoal) {
      // Mid-week upload: refresh actual_spent and score from merged data, keep goal
      const cats        = financialProfile.categories as Record<string, number>
      const actualSpent = cats[existingGoal.goal_category] ?? 0
      const score       = calculateScore(
        actualSpent,
        existingGoal.goal_amount,
        financialProfile.total_spent,
        financialProfile.total_income,
      )

      await db.from('weekly_goals')
        .update({ actual_spent: actualSpent, score })
        .eq('id', existingGoal.id)

      // Update wave difficulty for the new score — no point re-award on mid-week uploads
      const params = scoreToWaveParams(score)
      await db.from('wave_config').upsert(
        { user_id: userId, week_number: weekNumber, financial_score: score, ...params },
        { onConflict: 'user_id,week_number' }
      )
    } else {
      // Pass 2: first upload of week — goalAgent picks the category goal
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

      // Score is now based on the actual goal category spend vs goal amount
      const cats        = financialProfile.categories as Record<string, number>
      const actualSpent = cats[goalResult.goal_category] ?? 0
      const score       = calculateScore(
        actualSpent,
        goalResult.goal_amount,
        financialProfile.total_spent,
        financialProfile.total_income,
      )

      await db.from('weekly_goals').insert({
        user_id: userId,
        week_start_date: currentMonday,
        goal_amount:   goalResult.goal_amount,
        goal_category: goalResult.goal_category,
        goal_label:    goalResult.goal_label,
        actual_spent:  actualSpent,
        score,
        completed: false,
      })

      // Award points for first upload and set wave difficulty
      await runGameEngineAgent(userId, score, weekNumber, token, { points: 0, health: 0 })

      // Snapshot week_start from post-gameEngine game_state so the game loads correctly
      const { data: freshGs } = await db.from('game_state')
        .select('points, city_health').eq('user_id', userId).single()
      await db.from('game_state').update({
        week_start_points: freshGs?.points    ?? 0,
        week_start_health: freshGs?.city_health ?? 100,
        best_points_week: 0,
        best_health_week: 0,
        plays_this_week:  0,
      }).eq('user_id', userId)
    }

    // For W2: update week_start after gameEngine ran (carry + upload reward)
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
