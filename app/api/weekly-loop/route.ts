import { NextRequest, NextResponse } from 'next/server'
import { runAnalystAgent } from '@/agents/analyst'
import { runGameEngineAgent } from '@/agents/gameEngine'
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

    // Determine if we're in a new calendar week vs same week re-sync
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]
    const lastWeekStart = goal?.week_start_date ? new Date(goal.week_start_date) : null
    const daysSinceLastWeek = lastWeekStart
      ? Math.floor((today.getTime() - lastWeekStart.getTime()) / (1000 * 60 * 60 * 24))
      : 999
    const isNewWeek = !goal || goal.completed || daysSinceLastWeek >= 7

    const financialProfile = await runAnalystAgent(userId, profile.nessie_account_id, goalAmount, token)

    const { data: gameState } = await db.from('game_state')
      .select('week_number')
      .eq('user_id', userId)
      .single()

    const weekNumber = gameState?.week_number ?? 1
    const nextWeek = isNewWeek ? weekNumber + 1 : weekNumber

    // Only open a new goal row when the calendar week has turned
    if (isNewWeek) {
      // Pick the top spending category and set a targeted reduction goal
      const cats = financialProfile.categories
      const categoryLabels: Record<string, string> = {
        food: 'food', subscriptions: 'subscriptions', shopping: 'shopping',
        transport: 'transport', entertainment: 'entertainment', utilities: 'utilities', other: 'other spending',
      }
      const [topCat, topAmt] = Object.entries(cats).sort(([, a], [, b]) => b - a)[0] ?? ['other', 0]
      const targetAmt = Math.round(topAmt * 0.8)
      const newGoalLabel = `Reduce ${categoryLabels[topCat] ?? topCat} spend from $${Math.round(topAmt)} → $${targetAmt}`

      await db.from('weekly_goals').insert({
        user_id: userId,
        week_start_date: todayStr,
        goal_amount: targetAmt,
        goal_category: topCat,
        goal_label: newGoalLabel,
        actual_spent: 0,
        score: 0,
        completed: false,
      })
    }

    const waveConfig = await runGameEngineAgent(userId, financialProfile.score, nextWeek, token)

    return NextResponse.json({ financialProfile, waveConfig })
  } catch (err: any) {
    console.error('[weekly-loop]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
