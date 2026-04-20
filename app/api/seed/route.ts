import { NextRequest, NextResponse } from 'next/server'
import { seedNessieAccount } from '@/lib/seed'
import { createAuthClient } from '@/lib/supabase'

function isoWeekStart(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const day = d.getUTCDay()
  d.setUTCDate(d.getUTCDate() - (day === 0 ? 6 : day - 1))
  return d.toISOString().split('T')[0]
}

function weeksAgoMonday(n: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - n * 7)
  return isoWeekStart(d)
}

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

    // Seed 4 weeks of historical goals matching the 4 weeks of Nessie transaction data.
    // Scores and categories vary to give a realistic history.
    await db.from('weekly_goals').insert([
      { user_id: userId, week_start_date: weeksAgoMonday(3), goal_amount: 820,  goal_category: 'food',          goal_label: 'Cut back on dining out',          score: 62, actual_spent: 780,  completed: true  },
      { user_id: userId, week_start_date: weeksAgoMonday(2), goal_amount: 300,  goal_category: 'subscriptions', goal_label: 'Review your subscriptions',        score: 44, actual_spent: 390,  completed: true  },
      { user_id: userId, week_start_date: weeksAgoMonday(1), goal_amount: 950,  goal_category: 'shopping',      goal_label: 'Limit impulse purchases',         score: 78, actual_spent: 820,  completed: true  },
      { user_id: userId, week_start_date: weeksAgoMonday(0), goal_amount: 850,  goal_category: 'food',          goal_label: 'Keep food spend under $850',       score: 0,  actual_spent: 0,    completed: false },
    ])

    return NextResponse.json({ customerId, accountId })
  } catch (err: any) {
    console.error('[seed]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
