import { NextRequest, NextResponse } from 'next/server'
import { seedNessieAccount } from '@/lib/seed'
import { createAuthClient } from '@/lib/supabase'

export const maxDuration = 120

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { userId, firstName, lastName } = await req.json()
    if (!userId || !firstName || !lastName)
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const db = createAuthClient(token)

    const { customerId, accountId } = await seedNessieAccount(firstName, lastName)

    await db.from('profiles')
      .update({ nessie_customer_id: customerId, nessie_account_id: accountId })
      .eq('id', userId)

    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - weekStart.getDay())
    await db.from('weekly_goals').insert({
      user_id: userId,
      week_start_date: weekStart.toISOString().split('T')[0],
      goal_amount: 3000,
    })

    return NextResponse.json({ customerId, accountId })
  } catch (err: any) {
    console.error('[seed]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
