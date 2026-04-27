import { NextRequest, NextResponse } from 'next/server'
import { runAnalystAgent } from '@/agents/analyst'
import { runGameEngineAgent } from '@/agents/gameEngine'
import { createAuthClient } from '@/lib/supabase'
import { isoWeekStart, calculateScore } from '@/lib/utils'

export const maxDuration = 300

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { userId } = await req.json()
    if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 })

    const db = createAuthClient(token)

    const { count } = await db.from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
    if (!count || count === 0)
      return NextResponse.json({ error: 'No data found. Run setup first.' }, { status: 400 })

    const { data: goal } = await db.from('weekly_goals')
      .select('goal_amount, goal_category, week_start_date, completed')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    const today = new Date()
    const weekStartStr = isoWeekStart(today)
    const calendarWeekTurned = !goal || goal.week_start_date !== weekStartStr

    const financialProfile = await runAnalystAgent(userId, token)

    const { data: gameState } = await db.from('game_state')
      .select('week_number')
      .eq('user_id', userId)
      .single()

    const weekNumber = gameState?.week_number ?? 1
    const nextWeek = calendarWeekTurned ? weekNumber + 1 : weekNumber

    const { data: savedTxns } = await db
      .from('transactions')
      .select('category, amount, transaction_date')
      .eq('user_id', userId)
    const catTotals: Record<string, number> = {}
    savedTxns?.forEach(t => {
      if (t.category && t.category !== 'income')
        catTotals[t.category] = (catTotals[t.category] ?? 0) + Number(t.amount)
    })

    // ── Goal completion — only runs when calendar week turns ────────────────
    let goalPointsDelta = 0
    let goalHealthDelta = 0
    let goalAchieved = false

    if (calendarWeekTurned && goal?.goal_category && goal?.goal_amount) {
      const weekCatTotals: Record<string, number> = {}
      savedTxns?.forEach(t => {
        if (!t.category || t.category === 'income' || !t.transaction_date) return
        if (t.transaction_date < goal.week_start_date || t.transaction_date >= weekStartStr) return
        weekCatTotals[t.category] = (weekCatTotals[t.category] ?? 0) + Number(t.amount)
      })

      const categorySpend = weekCatTotals[goal.goal_category] ?? 0
      const missRatio = categorySpend / goal.goal_amount
      const closingScore = calculateScore(
        categorySpend, goal.goal_amount,
        financialProfile.total_spent, financialProfile.total_income,
      )

      if (missRatio <= 1.0) {
        goalAchieved = true
        goalPointsDelta = missRatio <= 0.8 ? 75 : 50
        goalHealthDelta = missRatio <= 0.8 ? 10 : 5
      } else if (missRatio <= 1.2) {
        goalPointsDelta = 0
        goalHealthDelta = 0
      } else {
        goalPointsDelta = 0
        goalHealthDelta = missRatio >= 1.5 ? -20 : -10
      }

      await db.from('weekly_goals')
        .update({ actual_spent: categorySpend, score: closingScore, completed: true })
        .eq('user_id', userId)
        .eq('completed', false)
        .eq('week_start_date', goal.week_start_date)

      // Close any remaining stale incomplete goals
      await db.from('weekly_goals')
        .update({ completed: true })
        .eq('user_id', userId)
        .eq('completed', false)
    }

    // After a week turn there is no active goal — user must pick a new one
    const needsGoalSelection = calendarWeekTurned || !goal?.goal_category

    // Wave score: use active goal if one exists, otherwise 50 (neutral difficulty)
    const activeGoalCategory = needsGoalSelection ? '' : (goal?.goal_category ?? '')
    const activeCategorySpend = catTotals[activeGoalCategory] ?? 0
    const waveScore = needsGoalSelection
      ? 50
      : calculateScore(
          activeCategorySpend, goal?.goal_amount ?? 3000,
          financialProfile.total_spent, financialProfile.total_income,
        )

    const waveConfig = await runGameEngineAgent(
      userId, waveScore, nextWeek, token,
      { points: goalPointsDelta, health: goalHealthDelta }
    )

    // Keep active goal's score current (no-op when no active goal)
    if (!needsGoalSelection) {
      await db.from('weekly_goals')
        .update({ score: waveScore })
        .eq('user_id', userId)
        .eq('completed', false)
    }

    return NextResponse.json({
      financialProfile, waveConfig, goalAchieved, goalPointsDelta, goalHealthDelta, needsGoalSelection,
    })
  } catch (err: any) {
    console.error('[weekly-loop]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
