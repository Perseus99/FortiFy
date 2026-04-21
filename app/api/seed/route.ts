import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient } from '@/lib/supabase'
import { weeksAgoMonday, daysAgo } from '@/lib/utils'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { userId } = await req.json()
    if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 })

    const db = createAuthClient(token)

    await db.from('transactions').delete().eq('user_id', userId)
    await db.from('weekly_goals').delete().eq('user_id', userId)

    // ~88 transactions across 4 weeks — realistic narrative arc, bi-weekly paychecks
    // Monthly subs appear once in the period they're due; subscriptions vary each week
    await db.from('transactions').insert([

      // ── Week 1 (days 28–22): Food disaster — eating out constantly ──────
      { user_id: userId, merchant: 'Starbucks Coffee',        category: 'food',          amount:   6.50, transaction_date: daysAgo(28), flagged: false, flag_reason: null },
      { user_id: userId, merchant: 'Netflix',                 category: 'subscriptions', amount:  15.49, transaction_date: daysAgo(28), flagged: true,  flag_reason: 'Monthly subscription — review if still in use' },
      { user_id: userId, merchant: 'Cinema Tickets',          category: 'entertainment', amount:  18.00, transaction_date: daysAgo(28), flagged: false, flag_reason: null },
      { user_id: userId, merchant: 'Chipotle Restaurant',     category: 'food',          amount:  45.00, transaction_date: daysAgo(27), flagged: false, flag_reason: null },
      { user_id: userId, merchant: 'Amazon Marketplace',      category: 'shopping',      amount:  78.99, transaction_date: daysAgo(27), flagged: true,  flag_reason: 'Frequent online shopping — impulse risk' },
      { user_id: userId, merchant: 'CVS Pharmacy',            category: 'shopping',      amount:  23.50, transaction_date: daysAgo(27), flagged: false, flag_reason: null },
      { user_id: userId, merchant: 'Starbucks Coffee',        category: 'food',          amount:   7.25, transaction_date: daysAgo(26), flagged: false, flag_reason: null },
      { user_id: userId, merchant: 'Local Grill & Bistro',    category: 'food',          amount:  67.50, transaction_date: daysAgo(26), flagged: false, flag_reason: null },
      { user_id: userId, merchant: 'Shell Gas Station',       category: 'transport',     amount:  45.00, transaction_date: daysAgo(26), flagged: false, flag_reason: null },
      { user_id: userId, merchant: 'Target Store',            category: 'shopping',      amount:  94.50, transaction_date: daysAgo(25), flagged: false, flag_reason: null },
      { user_id: userId, merchant: 'Verizon Phone Bill',      category: 'utilities',     amount:  85.00, transaction_date: daysAgo(25), flagged: false, flag_reason: null },
      { user_id: userId, merchant: 'Starbucks Coffee',        category: 'food',          amount:   6.50, transaction_date: daysAgo(24), flagged: false, flag_reason: null },
      { user_id: userId, merchant: 'Whole Foods Market',      category: 'food',          amount: 112.00, transaction_date: daysAgo(24), flagged: true,  flag_reason: 'Large grocery bill — higher than typical' },
      { user_id: userId, merchant: 'Lyft',                    category: 'transport',     amount:  12.50, transaction_date: daysAgo(24), flagged: false, flag_reason: null },
      { user_id: userId, merchant: 'Chipotle Restaurant',     category: 'food',          amount:  38.50, transaction_date: daysAgo(23), flagged: false, flag_reason: null },
      { user_id: userId, merchant: 'Uber Eats',               category: 'food',          amount:  34.99, transaction_date: daysAgo(23), flagged: true,  flag_reason: 'Food delivery markup — cooking at home would save ~30%' },
      { user_id: userId, merchant: 'Walgreens',               category: 'shopping',      amount:  19.99, transaction_date: daysAgo(23), flagged: false, flag_reason: null },
      { user_id: userId, merchant: 'Starbucks Coffee',        category: 'food',          amount:   8.75, transaction_date: daysAgo(22), flagged: false, flag_reason: null },
      { user_id: userId, merchant: 'Local Grill & Bistro',    category: 'food',          amount:  89.00, transaction_date: daysAgo(22), flagged: true,  flag_reason: '3rd restaurant meal this week — dining spend is piling up' },
      { user_id: userId, merchant: 'Steam Game Store',        category: 'entertainment', amount:  29.99, transaction_date: daysAgo(22), flagged: false, flag_reason: null },
      { user_id: userId, merchant: 'DoorDash',                category: 'food',          amount:  22.50, transaction_date: daysAgo(22), flagged: true,  flag_reason: 'Second food delivery this week — delivery fees add up' },
      { user_id: userId, merchant: 'iTunes Store',            category: 'entertainment', amount:   9.99, transaction_date: daysAgo(22), flagged: false, flag_reason: null },

      // ── Week 2 (days 21–15): Payday — shopping spikes, Amazon 3× ───────
      { user_id: userId, merchant: 'Direct Deposit — Paycheck', category: 'income',      amount: 2800.00, transaction_date: daysAgo(21), flagged: false, flag_reason: null },
      { user_id: userId, merchant: 'Starbucks Coffee',        category: 'food',          amount:   6.50, transaction_date: daysAgo(21), flagged: false, flag_reason: null },
      { user_id: userId, merchant: 'Spotify',                 category: 'subscriptions', amount:   9.99, transaction_date: daysAgo(21), flagged: true,  flag_reason: 'Monthly subscription charge' },
      { user_id: userId, merchant: 'Chipotle Restaurant',     category: 'food',          amount:  32.00, transaction_date: daysAgo(20), flagged: false, flag_reason: null },
      { user_id: userId, merchant: 'Amazon Marketplace',      category: 'shopping',      amount:  89.99, transaction_date: daysAgo(20), flagged: true,  flag_reason: 'Impulse purchase right after payday' },
      { user_id: userId, merchant: 'Shell Gas Station',       category: 'transport',     amount:  42.00, transaction_date: daysAgo(20), flagged: false, flag_reason: null },
      { user_id: userId, merchant: 'Starbucks Coffee',        category: 'food',          amount:   7.25, transaction_date: daysAgo(19), flagged: false, flag_reason: null },
      { user_id: userId, merchant: 'Comcast Internet',        category: 'utilities',     amount:  75.00, transaction_date: daysAgo(19), flagged: false, flag_reason: null },
      { user_id: userId, merchant: 'Amazon Marketplace',      category: 'shopping',      amount: 145.00, transaction_date: daysAgo(18), flagged: true,  flag_reason: '2nd Amazon order this week — $235 on Amazon so far' },
      { user_id: userId, merchant: 'Local Grill & Bistro',    category: 'food',          amount:  52.50, transaction_date: daysAgo(18), flagged: false, flag_reason: null },
      { user_id: userId, merchant: 'Starbucks Coffee',        category: 'food',          amount:   6.50, transaction_date: daysAgo(17), flagged: false, flag_reason: null },
      { user_id: userId, merchant: 'Target Store',            category: 'shopping',      amount:  67.00, transaction_date: daysAgo(17), flagged: false, flag_reason: null },
      { user_id: userId, merchant: 'Lyft',                    category: 'transport',     amount:   8.50, transaction_date: daysAgo(17), flagged: false, flag_reason: null },
      { user_id: userId, merchant: 'Chipotle Restaurant',     category: 'food',          amount:  28.50, transaction_date: daysAgo(16), flagged: false, flag_reason: null },
      { user_id: userId, merchant: 'Steam Game Store',        category: 'entertainment', amount:  49.99, transaction_date: daysAgo(16), flagged: true,  flag_reason: 'Impulse gaming purchase — 3rd entertainment spend this week' },
      { user_id: userId, merchant: 'Cinema Tickets',          category: 'entertainment', amount:  24.00, transaction_date: daysAgo(16), flagged: false, flag_reason: null },
      { user_id: userId, merchant: 'Starbucks Coffee',        category: 'food',          amount:   8.75, transaction_date: daysAgo(15), flagged: false, flag_reason: null },
      { user_id: userId, merchant: 'Amazon Marketplace',      category: 'shopping',      amount: 112.00, transaction_date: daysAgo(15), flagged: true,  flag_reason: '3rd Amazon order this week — $347 on Amazon this week alone' },
      { user_id: userId, merchant: 'Uber Eats',               category: 'food',          amount:  19.99, transaction_date: daysAgo(15), flagged: false, flag_reason: null },
      { user_id: userId, merchant: 'Walgreens',               category: 'shopping',      amount:  31.00, transaction_date: daysAgo(15), flagged: false, flag_reason: null },

      // ── Week 3 (days 14–8): Cutting back — cheaper café, meal prepping ─
      { user_id: userId, merchant: 'Corner Café',             category: 'food',          amount:   4.50, transaction_date: daysAgo(14), flagged: false, flag_reason: null },
      { user_id: userId, merchant: 'Adobe Creative Cloud',    category: 'subscriptions', amount:  54.99, transaction_date: daysAgo(14), flagged: true,  flag_reason: 'Monthly $55 subscription — consider if actively used' },
      { user_id: userId, merchant: 'Shell Gas Station',       category: 'transport',     amount:  40.00, transaction_date: daysAgo(14), flagged: false, flag_reason: null },
      { user_id: userId, merchant: "Trader Joe's",            category: 'food',          amount:  87.00, transaction_date: daysAgo(13), flagged: false, flag_reason: null },
      { user_id: userId, merchant: 'Corner Café',             category: 'food',          amount:   4.50, transaction_date: daysAgo(13), flagged: false, flag_reason: null },
      { user_id: userId, merchant: 'Lyft',                    category: 'transport',     amount:  11.00, transaction_date: daysAgo(13), flagged: false, flag_reason: null },
      { user_id: userId, merchant: 'Chipotle Restaurant',     category: 'food',          amount:  22.00, transaction_date: daysAgo(12), flagged: false, flag_reason: null },
      { user_id: userId, merchant: 'Corner Café',             category: 'food',          amount:   4.50, transaction_date: daysAgo(12), flagged: false, flag_reason: null },
      { user_id: userId, merchant: 'Cinema Tickets',          category: 'entertainment', amount:  16.00, transaction_date: daysAgo(12), flagged: false, flag_reason: null },
      { user_id: userId, merchant: 'Target Store',            category: 'shopping',      amount:  45.00, transaction_date: daysAgo(11), flagged: false, flag_reason: null },
      { user_id: userId, merchant: 'Corner Café',             category: 'food',          amount:   4.50, transaction_date: daysAgo(11), flagged: false, flag_reason: null },
      { user_id: userId, merchant: "Trader Joe's",            category: 'food',          amount:  72.00, transaction_date: daysAgo(10), flagged: false, flag_reason: null },
      { user_id: userId, merchant: 'Corner Café',             category: 'food',          amount:   4.50, transaction_date: daysAgo(10), flagged: false, flag_reason: null },
      { user_id: userId, merchant: 'Steam Game Store',        category: 'entertainment', amount:  14.99, transaction_date: daysAgo(10), flagged: false, flag_reason: null },
      { user_id: userId, merchant: 'Chipotle Restaurant',     category: 'food',          amount:  18.50, transaction_date: daysAgo(9),  flagged: false, flag_reason: null },
      { user_id: userId, merchant: 'Corner Café',             category: 'food',          amount:   4.50, transaction_date: daysAgo(9),  flagged: false, flag_reason: null },
      { user_id: userId, merchant: 'CVS Pharmacy',            category: 'shopping',      amount:  18.00, transaction_date: daysAgo(9),  flagged: false, flag_reason: null },
      { user_id: userId, merchant: 'Local Grill & Bistro',    category: 'food',          amount:  38.00, transaction_date: daysAgo(8),  flagged: false, flag_reason: null },
      { user_id: userId, merchant: 'Corner Café',             category: 'food',          amount:   4.50, transaction_date: daysAgo(8),  flagged: false, flag_reason: null },
      { user_id: userId, merchant: 'Amazon Marketplace',      category: 'shopping',      amount:  55.00, transaction_date: daysAgo(8),  flagged: false, flag_reason: null },

      // ── Week 4 (days 7–1): Payday — subscriptions all hit, food controlled
      { user_id: userId, merchant: 'Direct Deposit — Paycheck', category: 'income',      amount: 2800.00, transaction_date: daysAgo(7), flagged: false, flag_reason: null },
      { user_id: userId, merchant: 'Netflix',                 category: 'subscriptions', amount:  15.49, transaction_date: daysAgo(7),  flagged: true,  flag_reason: '2nd Netflix charge in 4 weeks — still worth it?' },
      { user_id: userId, merchant: 'Corner Café',             category: 'food',          amount:   4.50, transaction_date: daysAgo(7),  flagged: false, flag_reason: null },
      { user_id: userId, merchant: 'Shell Gas Station',       category: 'transport',     amount:  38.00, transaction_date: daysAgo(7),  flagged: false, flag_reason: null },
      { user_id: userId, merchant: "Trader Joe's",            category: 'food',          amount:  95.00, transaction_date: daysAgo(6),  flagged: false, flag_reason: null },
      { user_id: userId, merchant: 'Corner Café',             category: 'food',          amount:   4.50, transaction_date: daysAgo(6),  flagged: false, flag_reason: null },
      { user_id: userId, merchant: 'Lyft',                    category: 'transport',     amount:   9.50, transaction_date: daysAgo(6),  flagged: false, flag_reason: null },
      { user_id: userId, merchant: 'Chipotle Restaurant',     category: 'food',          amount:  24.00, transaction_date: daysAgo(5),  flagged: false, flag_reason: null },
      { user_id: userId, merchant: 'Adobe Creative Cloud',    category: 'subscriptions', amount:  54.99, transaction_date: daysAgo(5),  flagged: true,  flag_reason: 'Monthly Adobe charge — actively using it?' },
      { user_id: userId, merchant: 'Corner Café',             category: 'food',          amount:   4.50, transaction_date: daysAgo(5),  flagged: false, flag_reason: null },
      { user_id: userId, merchant: 'Target Store',            category: 'shopping',      amount:  38.00, transaction_date: daysAgo(4),  flagged: false, flag_reason: null },
      { user_id: userId, merchant: 'Corner Café',             category: 'food',          amount:   4.50, transaction_date: daysAgo(4),  flagged: false, flag_reason: null },
      { user_id: userId, merchant: 'Cinema Tickets',          category: 'entertainment', amount:  22.00, transaction_date: daysAgo(4),  flagged: false, flag_reason: null },
      { user_id: userId, merchant: 'Verizon Phone Bill',      category: 'utilities',     amount:  85.00, transaction_date: daysAgo(3),  flagged: false, flag_reason: null },
      { user_id: userId, merchant: "Trader Joe's",            category: 'food',          amount:  68.00, transaction_date: daysAgo(3),  flagged: false, flag_reason: null },
      { user_id: userId, merchant: 'Corner Café',             category: 'food',          amount:   4.50, transaction_date: daysAgo(3),  flagged: false, flag_reason: null },
      { user_id: userId, merchant: 'Spotify',                 category: 'subscriptions', amount:   9.99, transaction_date: daysAgo(2),  flagged: true,  flag_reason: 'Monthly subscription — Netflix + Adobe + Spotify is $80/mo combined' },
      { user_id: userId, merchant: 'Chipotle Restaurant',     category: 'food',          amount:  21.50, transaction_date: daysAgo(2),  flagged: false, flag_reason: null },
      { user_id: userId, merchant: 'Corner Café',             category: 'food',          amount:   4.50, transaction_date: daysAgo(2),  flagged: false, flag_reason: null },
      { user_id: userId, merchant: 'Steam Game Store',        category: 'entertainment', amount:  19.99, transaction_date: daysAgo(2),  flagged: false, flag_reason: null },
      { user_id: userId, merchant: 'Amazon Marketplace',      category: 'shopping',      amount:  67.50, transaction_date: daysAgo(1),  flagged: false, flag_reason: null },
      { user_id: userId, merchant: 'Corner Café',             category: 'food',          amount:   4.50, transaction_date: daysAgo(1),  flagged: false, flag_reason: null },
      { user_id: userId, merchant: 'CVS Pharmacy',            category: 'shopping',      amount:  14.00, transaction_date: daysAgo(1),  flagged: false, flag_reason: null },
    ])

    // 4 weekly goals — score arc tells a story (bad → mediocre → improving → ongoing)
    // goal_category and goal_label are intentionally omitted — Goal Agent sets these at sync time
    await db.from('weekly_goals').insert([
      {
        user_id: userId, week_start_date: weeksAgoMonday(3),
        goal_amount: 600, actual_spent: 487.98, score: 44, completed: true,
      },
      {
        user_id: userId, week_start_date: weeksAgoMonday(2),
        goal_amount: 600, actual_spent: 445.22, score: 51, completed: true,
      },
      {
        user_id: userId, week_start_date: weeksAgoMonday(1),
        goal_amount: 600, actual_spent: 363.48, score: 69, completed: true,
      },
      {
        user_id: userId, week_start_date: weeksAgoMonday(0),
        goal_amount: 600, actual_spent: 0, score: 0, completed: false,
      },
    ])

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[seed]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
