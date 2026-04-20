import { NextRequest, NextResponse } from 'next/server'

// Returns the ISO Monday of the week containing `date`, as YYYY-MM-DD (UTC)
function isoWeekStart(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const day = d.getUTCDay()
  d.setUTCDate(d.getUTCDate() - (day === 0 ? 6 : day - 1))
  return d.toISOString().split('T')[0]
}
import { runAnalystAgent } from '@/agents/analyst'
import { runGameEngineAgent } from '@/agents/gameEngine'
import { runGoalAgent } from '@/agents/goalAgent'
import { createAuthClient } from '@/lib/supabase'

export const maxDuration = 300

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { userId } = await req.json()
    if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 })

    const db = createAuthClient(token)

    const { data: profile } = await db.from('profiles')
      .select('nessie_account_id')
      .eq('id', userId)
      .single()

    if (!profile?.nessie_account_id)
      return NextResponse.json({ error: 'No Nessie account. Run /api/seed first.' }, { status: 400 })

    const { data: goal } = await db.from('weekly_goals')
      .select('goal_amount, goal_category, week_start_date, completed')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    const goalAmount = goal?.goal_amount ?? 3000

    // ISO week start = Monday of the current calendar week (UTC)
    const today = new Date()
    const weekStartStr = isoWeekStart(today)
    // A new week has turned if the current ISO Monday differs from the last goal's week_start_date
    const calendarWeekTurned = !goal || goal.week_start_date !== weekStartStr

    // Run analyst — always marks current incomplete goal as completed
    const financialProfile = await runAnalystAgent(userId, profile.nessie_account_id, goalAmount, token)

    const { data: gameState } = await db.from('game_state')
      .select('week_number')
      .eq('user_id', userId)
      .single()

    const weekNumber = gameState?.week_number ?? 1
    const nextWeek = calendarWeekTurned ? weekNumber + 1 : weekNumber

    // Compute accurate category totals from saved transactions
    const { data: savedTxns } = await db.from('transactions').select('category, amount').eq('user_id', userId)
    const catTotals: Record<string, number> = {}
    savedTxns?.forEach(t => {
      if (t.category) catTotals[t.category] = (catTotals[t.category] ?? 0) + Number(t.amount)
    })

    // Goal completion check: did they hit last week's category target?
    let goalPointsDelta = 0
    let goalHealthDelta = 0
    let goalAchieved = false
    if (goal?.goal_category && goal?.goal_amount) {
      const categorySpend = catTotals[goal.goal_category] ?? 0
      const missRatio = categorySpend / goal.goal_amount  // <1 = under target (good), >1 = over

      if (missRatio <= 1.0) {
        // Hit the goal — bonus scales with how much under they came in
        goalAchieved = true
        goalPointsDelta = missRatio <= 0.8 ? 75 : 50   // crushed it vs just made it
        goalHealthDelta = missRatio <= 0.8 ? 10 : 5
      } else if (missRatio <= 1.2) {
        // Close miss (within 20%) — no reward, no penalty
        goalPointsDelta = 0
        goalHealthDelta = 0
      } else {
        // Significant miss — penalize
        goalPointsDelta = 0
        goalHealthDelta = missRatio >= 1.5 ? -20 : -10
      }

      // Update closed goal with actual category spend
      await db.from('weekly_goals')
        .update({ actual_spent: categorySpend })
        .eq('user_id', userId)
        .eq('completed', true)
        .eq('goal_category', goal.goal_category)
        .order('created_at', { ascending: false })
        .limit(1)
    }

    // Load user's dismissed category preferences
    const { data: prefs } = await db.from('category_preferences')
      .select('category')
      .eq('user_id', userId)
      .eq('dismissed', true)
    const excludedCategories = (prefs ?? []).map(p => p.category)

    // Goal Agent: picks riskiest non-dismissed category
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
