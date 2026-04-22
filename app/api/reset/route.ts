import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { userId } = await req.json()
    if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 })

    const db = createAuthClient(token)

    await Promise.all([
      db.from('transactions').delete().eq('user_id', userId),
      db.from('weekly_goals').delete().eq('user_id', userId),
      db.from('wave_config').delete().eq('user_id', userId),
      db.from('npc_conversations').delete().eq('user_id', userId),
      db.from('category_preferences').delete().eq('user_id', userId),
      db.from('game_state').delete().eq('user_id', userId),
    ])

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[reset]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
