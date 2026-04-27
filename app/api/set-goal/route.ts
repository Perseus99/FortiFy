import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient } from '@/lib/supabase'
import { runGameEngineAgent } from '@/agents/gameEngine'
import { calculateScore } from '@/lib/utils'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { userId, category, amount, weekStartDate, weekNumber } = await req.json()
    if (!userId || !category || !amount || !weekStartDate || !weekNumber)
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })

    const db = createAuthClient(token)

    // Clear any stale incomplete goals
    await db.from('weekly_goals').delete()
      .eq('user_id', userId).eq('completed', false)

    // Actual spend for this category since tracking start
    const { data: catTxns } = await db.from('transactions')
      .select('amount')
      .eq('user_id', userId).eq('category', category)
      .gte('transaction_date', weekStartDate)
    const actualSpent = (catTxns ?? []).reduce((s: number, t: any) => s + Number(t.amount), 0)

    // Totals for score calculation
    const { data: allTxns } = await db.from('transactions')
      .select('amount, category').eq('user_id', userId)
    const totalIncome = (allTxns ?? [])
      .filter((t: any) => t.category === 'income')
      .reduce((s: number, t: any) => s + Number(t.amount), 0) || 5600
    const totalSpent = (allTxns ?? [])
      .filter((t: any) => t.category !== 'income')
      .reduce((s: number, t: any) => s + Number(t.amount), 0)

    const goalLabel = `Keep ${category} spend under $${Math.round(amount)} this week`

    await db.from('weekly_goals').insert({
      user_id:         userId,
      week_start_date: weekStartDate,
      goal_amount:     amount,
      goal_category:   category,
      goal_label:      goalLabel,
      actual_spent:    actualSpent,
      score:           0,
      completed:       false,
    })

    const score = calculateScore(actualSpent, amount, totalSpent, totalIncome)

    await runGameEngineAgent(userId, score, weekNumber, token, { points: 0, health: 0 })

    await db.from('weekly_goals')
      .update({ score })
      .eq('user_id', userId).eq('completed', false)

    // Snapshot week_start after initial score bonus is applied
    const { data: freshGs } = await db.from('game_state')
      .select('points, city_health').eq('user_id', userId).single()
    await db.from('game_state').update({
      week_start_points: freshGs?.points      ?? 0,
      week_start_health: freshGs?.city_health ?? 100,
    }).eq('user_id', userId)

    return NextResponse.json({ ok: true, score, category, amount })
  } catch (err: any) {
    console.error('[set-goal]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
