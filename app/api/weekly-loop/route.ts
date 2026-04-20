import { NextRequest, NextResponse } from 'next/server'
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
      .select('goal_amount, week_start_date, completed')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    const goalAmount = goal?.goal_amount ?? 3000

    // Date check: has a real calendar week passed since the last goal?
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]
    const lastWeekStart = goal?.week_start_date ? new Date(goal.week_start_date) : null
    const daysSinceLastWeek = lastWeekStart
      ? Math.floor((today.getTime() - lastWeekStart.getTime()) / (1000 * 60 * 60 * 24))
      : 999
    const calendarWeekTurned = !goal || daysSinceLastWeek >= 7

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
      week_start_date: todayStr,
      goal_amount: goalResult.goal_amount,
      goal_category: goalResult.goal_category,
      goal_label: goalResult.goal_label,
      actual_spent: 0,
      score: 0,
      completed: false,
    })

    const waveConfig = await runGameEngineAgent(userId, financialProfile.score, nextWeek, token)

    return NextResponse.json({ financialProfile, waveConfig })
  } catch (err: any) {
    console.error('[weekly-loop]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
