import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const userId  = searchParams.get('userId')
    const npcType = searchParams.get('npcType')
    if (!userId || !npcType) return NextResponse.json({ error: 'Missing params' }, { status: 400 })

    const db = createAuthClient(token)
    const { data } = await db.from('npc_conversations')
      .select('messages')
      .eq('user_id', userId)
      .eq('npc_type', npcType)
      .single()

    return NextResponse.json({ messages: data?.messages ?? [] })
  } catch (err: any) {
    return NextResponse.json({ messages: [] })
  }
}
