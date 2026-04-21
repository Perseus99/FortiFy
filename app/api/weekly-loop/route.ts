import { NextRequest, NextResponse } from 'next/server'
import { runAnalystAgent } from '@/agents/analyst'
import { runGameEngineAgent } from '@/agents/gameEngine'
import { runGoalAgent } from '@/agents/goalAgent'
import { createAuthClient } from '@/lib/supabase'

// Returns the ISO Monday of the week containing `date`, as YYYY-MM-DD (UTC)
function isoWeekStart(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const day = d.getUTCDay()
  d.setUTCDate(d.getUTCDate() - (day === 0 ? 6 : day - 1))
  return d.toISOString().split('T')[0]
}

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

    const goalAmount = goal?.goal_amount ?? 3000

    const today = new Date()
    const weekStartStr = isoWeekStart(today)
    // A new week has turned if the current ISO Monday differs from the last goal's week_start_date
    const calendarWeekTurned = !goal || goal.week_start_date !== weekStartStr

    // Analyst computes FinancialProfile from all transactions (goal-closing moved to weekly-loop below)
    const financialProfile = await runAnalystAgent(userId, goalAmount, token)

    const { data: gameState } = await db.from('game_state')
      .select('week_number')
      .eq('user_id', userId)
      .single()

    const weekNumber = gameState?.week_number ?? 1
    const nextWeek = calendarWeekTurned ? weekNumber + 1 : weekNumber

    // All-time category totals (income excluded) — used by Goal Agent to pick riskiest category
    const { data: savedTxns } = await db
      .from('transactions')
      .select('category, amount, transaction_date')
      .eq('user_id', userId)
    const catTotals: Record<string, number> = {}
    savedTxns?.forEach(t => {
      if (t.category && t.category !== 'income')
        catTotals[t.category] = (catTotals[t.category] ?? 0) + Number(t.amount)
    })

    // ── Goal completion ──────────────────────────────────────────────────────
    // Only runs when a new calendar week starts — prevents repeat rewards on every sync
    let goalPointsDelta = 0
    let goalHealthDelta = 0
    let goalAchieved = false

    if (calendarWeekTurned && goal?.goal_category && goal?.goal_amount) {
      // Spend within the CLOSED week's date range only (not all-time)
      const weekCatTotals: Record<string, number> = {}
      savedTxns?.forEach(t => {
        if (!t.category || t.category === 'income' || !t.transaction_date) return
        if (t.transaction_date < goal.week_start_date || t.transaction_date >= weekStartStr) return
        weekCatTotals[t.category] = (weekCatTotals[t.category] ?? 0) + Number(t.amount)
      })

      const categorySpend = weekCatTotals[goal.goal_category] ?? 0
      const missRatio = categorySpend / goal.goal_amount

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

      // Close the goal with week-accurate category spend and the analyst's score
      await db.from('weekly_goals')
        .update({ actual_spent: categorySpend, score: financialProfile.score, completed: true })
        .eq('user_id', userId)
        .eq('completed', false)
        .eq('week_start_date', goal.week_start_date)
    }

    // ── New goal ─────────────────────────────────────────────────────────────
    // Create when: (a) calendar week turned, or (b) active goal has no category yet
    // Case (b) handles first sync after setup where the seeded goal has no goal_category
    const needsNewGoal = calendarWeekTurned || !goal?.goal_category

    if (needsNewGoal) {
      // Close any remaining incomplete goals (e.g. orphaned seeded goal with no category)
      await db.from('weekly_goals')
        .update({ completed: true, score: financialProfile.score })
        .eq('user_id', userId)
        .eq('completed', false)

      // Load user's dismissed category preferences
      const { data: prefs } = await db.from('category_preferences')
        .select('category')
        .eq('user_id', userId)
        .eq('dismissed', true)
      const excludedCategories = (prefs ?? []).map(p => p.category)

      const goalResult = await runGoalAgent({
        categories: catTotals,
        flaggedTransactions: financialProfile.flagged_transactions.map(t => ({
          merchant: t.merchant ?? 'Unknown',
          amount: Number(t.amount),
          flag_reason: t.flag_reason,
        })),
        totalSpent: financialProfile.total_spent,
        totalIncome: financialProfile.total_income,
        excludedCategories,
      })

      await db.from('weekly_goals').insert({
        user_id: userId,
        week_start_date: weekStartStr,
        goal_amount: goalResult.goal_amount,
        goal_category: goalResult.goal_category,
        goal_label: goalResult.goal_label,
        actual_spent: 0,
        score: 0,
        completed: false,
      })
    }

    const waveConfig = await runGameEngineAgent(
      userId, financialProfile.score, nextWeek, token,
      { points: goalPointsDelta, health: goalHealthDelta }
    )

    return NextResponse.json({ financialProfile, waveConfig, goalAchieved, goalPointsDelta, goalHealthDelta })
  } catch (err: any) {
    console.error('[weekly-loop]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
