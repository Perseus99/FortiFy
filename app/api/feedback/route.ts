import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient } from '@/lib/supabase'
import { runGoalAgent } from '@/agents/goalAgent'
import { buildPlayerContext } from '@/agents/contextAgent'
import { isoWeekStart } from '@/lib/utils'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { userId, category, reason } = await req.json()
    if (!userId || !category) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const db = createAuthClient(token)

    // Store the dismissed preference
    await db.from('category_preferences').upsert(
      { user_id: userId, category, dismissed: true, reason: reason ?? null, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,category' }
    )

    // Fetch all dismissed categories, all transactions, and player context in parallel
    const [{ data: prefs }, { data: txns }, playerHistory] = await Promise.all([
      db.from('category_preferences').select('category').eq('user_id', userId).eq('dismissed', true),
      db.from('transactions').select('category, amount, merchant, flagged, flag_reason').eq('user_id', userId),
      buildPlayerContext(userId, token),
    ])

    const excludedCategories = (prefs ?? []).map(p => p.category)

    const catTotals: Record<string, number> = {}
    const flagged: { merchant: string; amount: number; flag_reason: string | null }[] = []
    let totalSpent = 0
    let totalIncome = 0

    for (const t of txns ?? []) {
      if (t.category === 'income') {
        totalIncome += Number(t.amount)
        continue
      }
      if (t.category) {
        catTotals[t.category] = (catTotals[t.category] ?? 0) + Number(t.amount)
        totalSpent += Number(t.amount)
      }
      if (t.flagged) {
        flagged.push({ merchant: t.merchant ?? 'Unknown', amount: Number(t.amount), flag_reason: t.flag_reason })
      }
    }

    // Re-run Goal Agent with exclusions and full context
    const goalResult = await runGoalAgent({
      categories: catTotals,
      flaggedTransactions: flagged,
      totalSpent,
      totalIncome,
      excludedCategories,
      playerHistory,
    })

    // Mark current open goal completed and insert the recalculated one
    await db.from('weekly_goals')
      .update({ completed: true })
      .eq('user_id', userId)
      .eq('completed', false)

    const weekStartStr = isoWeekStart(new Date())
    const { data: newGoal } = await db.from('weekly_goals').insert({
      user_id: userId,
      week_start_date: weekStartStr,
      goal_amount: goalResult.goal_amount,
      goal_category: goalResult.goal_category,
      goal_label: goalResult.goal_label,
      actual_spent: 0,
      score: 0,
      completed: false,
    }).select().single()

    return NextResponse.json({ goal: newGoal, excludedCategories })
  } catch (err: any) {
    console.error('[feedback]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
