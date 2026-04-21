import { NextRequest, NextResponse } from 'next/server'
import { runNPCAgent, NPCType, NPCMessage, NPCContext } from '@/agents/npc'
import { buildPlayerContext } from '@/agents/contextAgent'
import { createAuthClient } from '@/lib/supabase'

export const maxDuration = 120

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { userId, npcType, messages, gameResult } = await req.json() as {
      userId: string
      npcType: NPCType
      messages: NPCMessage[]
      gameResult?: { won: boolean; points: number; cityHealth: number }
    }

    const db = createAuthClient(token)

    const [{ data: goal }, { data: txns }, { data: deposits }, playerHistory] = await Promise.all([
      db.from('weekly_goals').select('goal_amount,actual_spent,score')
        .eq('user_id', userId).eq('completed', false)
        .order('created_at', { ascending: false }).limit(1).single(),
      db.from('transactions').select('merchant,amount,category,flagged,flag_reason')
        .eq('user_id', userId).order('transaction_date', { ascending: false }).limit(30),
      db.from('transactions').select('amount').eq('user_id', userId).eq('category', 'income').limit(10),
      buildPlayerContext(userId, token),
    ])

    const categories: Record<string, number> = {}
    let totalSpent = 0
    for (const t of txns ?? []) {
      if (t.category === 'income') continue
      const cat = t.category ?? 'other'
      categories[cat] = (categories[cat] ?? 0) + Number(t.amount)
      totalSpent += Number(t.amount)
    }

    const totalIncome = (deposits ?? []).reduce((s, d) => s + Number(d.amount), 0)

    const context: NPCContext = {
      totalSpent:  goal?.actual_spent ?? totalSpent,
      goalAmount:  goal?.goal_amount  ?? 3000,
      score:       goal?.score        ?? 0,
      savingsRate: totalIncome > 0 ? (totalIncome - totalSpent) / totalIncome : undefined,
      totalIncome,
      categories,
      flaggedTransactions: (txns ?? [])
        .filter(t => t.flagged)
        .map(t => ({ merchant: t.merchant ?? 'Unknown', amount: Number(t.amount), flag_reason: t.flag_reason })),
      playerHistory,
      gameResult,
    }

    const reply = await runNPCAgent(npcType, messages, context)

    // Persist conversation — cap at 20 messages (~10 exchanges) so context stays lean
    const updated = [...messages, { role: 'assistant', content: reply }].slice(-20)
    await db.from('npc_conversations').upsert(
      { user_id: userId, npc_type: npcType, messages: updated, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,npc_type' }
    )

    return NextResponse.json({ reply })
  } catch (err: any) {
    console.error('[npc]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
