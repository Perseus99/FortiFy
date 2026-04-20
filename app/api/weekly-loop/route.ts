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
      .select('goal_amount')
      .eq('user_id', userId)
      .eq('completed', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    const goalAmount = goal?.goal_amount ?? 500

    const financialProfile = await runAnalystAgent(userId, profile.nessie_account_id, goalAmount, token)

    const { data: gameState } = await db.from('game_state')
      .select('week_number')
      .eq('user_id', userId)
      .single()

    const weekNumber = gameState?.week_number ?? 1
    const nextWeek = weekNumber + 1

    // Open a fresh goal for the coming week
    await db.from('weekly_goals').insert({
      user_id: userId,
      week_start_date: new Date().toISOString().split('T')[0],
      goal_amount: goalAmount,
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
