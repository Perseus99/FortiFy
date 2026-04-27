import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient } from '@/lib/supabase'
import { VALID_CATEGORIES } from '@/lib/types'

const MULTIPLIERS = { easy: 0.90, medium: 0.72, hard: 0.55 }

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const userId     = searchParams.get('userId')
    const difficulty = searchParams.get('difficulty') as keyof typeof MULTIPLIERS | null

    if (!userId || !difficulty || !(difficulty in MULTIPLIERS))
      return NextResponse.json({ error: 'Missing userId or difficulty' }, { status: 400 })

    const db = createAuthClient(token)
    const { data: txns } = await db
      .from('transactions')
      .select('category, amount')
      .eq('user_id', userId)
      .neq('category', 'income')

    const totals: Record<string, number> = {}
    for (const t of txns ?? []) {
      if (t.category && VALID_CATEGORIES.includes(t.category as any))
        totals[t.category] = (totals[t.category] ?? 0) + Number(t.amount)
    }

    const mult = MULTIPLIERS[difficulty]

    const options = Object.entries(totals)
      .filter(([, amt]) => amt > 1)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([category, current_spend]) => ({
        category,
        current_spend: Math.round(current_spend * 100) / 100,
        target_amount: Math.round(current_spend * mult * 100) / 100,
        savings:       Math.round(current_spend * (1 - mult) * 100) / 100,
      }))

    return NextResponse.json({ options, difficulty })
  } catch (err: any) {
    console.error('[goal-options]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
