import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient } from '@/lib/supabase'

export const maxDuration = 60

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

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { userId } = await req.json()
    if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 })

    const db = createAuthClient(token)

    // Clear existing data for clean re-seed
    await db.from('transactions').delete().eq('user_id', userId)
    await db.from('weekly_goals').delete().eq('user_id', userId)

    // 32 transactions across 4 weeks — pre-categorised, no Nessie required
    await db.from('transactions').insert([
      // ── Week 1 (days 28–22) ──────────────────────────────────────────
      { user_id: userId, merchant: 'Starbucks Coffee',     category: 'food',          amount: 6.50,   transaction_date: daysAgo(28), flagged: false, flag_reason: null },
      { user_id: userId, merchant: 'Netflix',              category: 'subscriptions', amount: 15.49,  transaction_date: daysAgo(27), flagged: true,  flag_reason: 'Recurring subscription — are you still using this?' },
      { user_id: userId, merchant: 'Chipotle Restaurant',  category: 'food',          amount: 52.00,  transaction_date: daysAgo(26), flagged: false, flag_reason: null },
      { user_id: userId, merchant: 'Amazon Marketplace',   category: 'shopping',      amount: 78.99,  transaction_date: daysAgo(25), flagged: true,  flag_reason: 'Frequent online shopping — impulse risk' },
      { user_id: userId, merchant: 'Spotify',              category: 'subscriptions', amount: 9.99,   transaction_date: daysAgo(24), flagged: true,  flag_reason: 'Recurring subscription charge' },
      { user_id: userId, merchant: 'Local Grill & Bistro', category: 'food',          amount: 67.50,  transaction_date: daysAgo(23), flagged: false, flag_reason: null },
      { user_id: userId, merchant: 'Target Store',         category: 'shopping',      amount: 94.50,  transaction_date: daysAgo(22), flagged: false, flag_reason: null },
      { user_id: userId, merchant: 'Verizon Phone Bill',   category: 'utilities',     amount: 85.00,  transaction_date: daysAgo(22), flagged: false, flag_reason: null },

      // ── Week 2 (days 21–15) ──────────────────────────────────────────
      { user_id: userId, merchant: 'Starbucks Coffee',     category: 'food',          amount: 8.75,   transaction_date: daysAgo(21), flagged: false, flag_reason: null },
      { user_id: userId, merchant: 'Adobe Subscription',   category: 'subscriptions', amount: 54.99,  transaction_date: daysAgo(20), flagged: true,  flag_reason: 'Recurring $55/mo — often forgotten' },
      { user_id: userId, merchant: 'Chipotle Restaurant',  category: 'food',          amount: 38.50,  transaction_date: daysAgo(19), flagged: false, flag_reason: null },
      { user_id: userId, merchant: 'Steam Game Store',     category: 'entertainment', amount: 49.99,  transaction_date: daysAgo(18), flagged: true,  flag_reason: 'Impulse gaming purchase' },
      { user_id: userId, merchant: 'Amazon Marketplace',   category: 'shopping',      amount: 132.00, transaction_date: daysAgo(17), flagged: true,  flag_reason: 'Second large Amazon purchase this month' },
      { user_id: userId, merchant: 'Ithaca Bakery & Cafe', category: 'food',          amount: 23.50,  transaction_date: daysAgo(16), flagged: false, flag_reason: null },
      { user_id: userId, merchant: 'Cinema Movie Tickets', category: 'entertainment', amount: 34.00,  transaction_date: daysAgo(15), flagged: false, flag_reason: null },
      { user_id: userId, merchant: 'Target Store',         category: 'shopping',      amount: 87.00,  transaction_date: daysAgo(15), flagged: false, flag_reason: null },

      // ── Week 3 (days 14–8) ───────────────────────────────────────────
      { user_id: userId, merchant: 'Starbucks Coffee',     category: 'food',          amount: 7.25,   transaction_date: daysAgo(14), flagged: false, flag_reason: null },
      { user_id: userId, merchant: 'Netflix',              category: 'subscriptions', amount: 15.49,  transaction_date: daysAgo(13), flagged: true,  flag_reason: 'Recurring subscription' },
      { user_id: userId, merchant: 'Local Grill & Bistro', category: 'food',          amount: 45.00,  transaction_date: daysAgo(12), flagged: false, flag_reason: null },
      { user_id: userId, merchant: 'Target Store',         category: 'shopping',      amount: 56.00,  transaction_date: daysAgo(11), flagged: false, flag_reason: null },
      { user_id: userId, merchant: 'Spotify',              category: 'subscriptions', amount: 9.99,   transaction_date: daysAgo(10), flagged: true,  flag_reason: 'Recurring subscription' },
      { user_id: userId, merchant: 'Chipotle Restaurant',  category: 'food',          amount: 41.75,  transaction_date: daysAgo(9),  flagged: false, flag_reason: null },
      { user_id: userId, merchant: 'Amazon Marketplace',   category: 'shopping',      amount: 198.00, transaction_date: daysAgo(8),  flagged: true,  flag_reason: 'Unusually large purchase' },

      // ── Week 4 (days 7–1) ────────────────────────────────────────────
      { user_id: userId, merchant: 'Starbucks Coffee',     category: 'food',          amount: 6.50,   transaction_date: daysAgo(7),  flagged: false, flag_reason: null },
      { user_id: userId, merchant: 'Adobe Subscription',   category: 'subscriptions', amount: 54.99,  transaction_date: daysAgo(6),  flagged: true,  flag_reason: 'Recurring $55/mo subscription' },
      { user_id: userId, merchant: 'Chipotle Restaurant',  category: 'food',          amount: 44.25,  transaction_date: daysAgo(5),  flagged: false, flag_reason: null },
      { user_id: userId, merchant: 'Target Store',         category: 'shopping',      amount: 63.50,  transaction_date: daysAgo(4),  flagged: false, flag_reason: null },
      { user_id: userId, merchant: 'Verizon Phone Bill',   category: 'utilities',     amount: 85.00,  transaction_date: daysAgo(3),  flagged: false, flag_reason: null },
      { user_id: userId, merchant: 'Local Grill & Bistro', category: 'food',          amount: 78.00,  transaction_date: daysAgo(2),  flagged: true,  flag_reason: 'Highest dining bill this month' },
      { user_id: userId, merchant: 'Steam Game Store',     category: 'entertainment', amount: 29.99,  transaction_date: daysAgo(1),  flagged: false, flag_reason: null },
    ])

    // 4 weekly goals — scores tell a narrative arc (decent → bad → recovering → ongoing)
    await db.from('weekly_goals').insert([
      {
        user_id: userId, week_start_date: weeksAgoMonday(3),
        goal_amount: 150,  goal_category: 'food',          goal_label: 'Keep food spend under $150',
        actual_spent: 126.00, score: 72, completed: true,
      },
      {
        user_id: userId, week_start_date: weeksAgoMonday(2),
        goal_amount: 80,   goal_category: 'subscriptions', goal_label: 'Cut back on subscriptions',
        actual_spent: 54.99, score: 45, completed: true,
      },
      {
        user_id: userId, week_start_date: weeksAgoMonday(1),
        goal_amount: 200,  goal_category: 'shopping',      goal_label: 'Limit impulse purchases',
        actual_spent: 254.00, score: 61, completed: true,
      },
      {
        user_id: userId, week_start_date: weeksAgoMonday(0),
        goal_amount: 150,  goal_category: 'food',          goal_label: 'Keep food spend under $150',
        actual_spent: 0, score: 0, completed: false,
      },
    ])

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[seed]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
