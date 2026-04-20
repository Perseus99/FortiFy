import { createAuthClient } from '@/lib/supabase'
import type { FinancialProfile, SpendingCategory, Transaction } from '@/lib/types'

const MONTHLY_INCOME = 6000   // assumed — no deposits table

function calculateScore(totalSpent: number, goalAmount: number): number {
  const withinGoal = totalSpent <= goalAmount ? 1 : goalAmount / totalSpent
  const savingsRate = Math.max(0, (MONTHLY_INCOME - totalSpent) / MONTHLY_INCOME)
  return Math.max(0, Math.min(100, Math.round((savingsRate * 0.4 + withinGoal * 0.6) * 100)))
}

export async function runAnalystAgent(
  userId: string, goalAmount: number, token: string
): Promise<FinancialProfile> {
  const db = createAuthClient(token)

  const { data: txns } = await db.from('transactions').select('*').eq('user_id', userId)
  const purchases = txns ?? []

  const categories: Record<SpendingCategory, number> = {
    food: 0, subscriptions: 0, shopping: 0, transport: 0, entertainment: 0, utilities: 0, other: 0,
  }
  for (const t of purchases) {
    if (t.category && t.category in categories)
      categories[t.category as SpendingCategory] += Number(t.amount)
  }

  const totalSpent = purchases.reduce((s: number, t: any) => s + Number(t.amount), 0)
  const score      = calculateScore(totalSpent, goalAmount)

  await db.from('weekly_goals')
    .update({ actual_spent: totalSpent, score, completed: true })
    .eq('user_id', userId)
    .eq('completed', false)

  return {
    score,
    total_spent:          totalSpent,
    total_income:         MONTHLY_INCOME,
    categories,
    flagged_transactions: purchases.filter((t: any) => t.flagged) as Transaction[],
    savings_rate:         Math.max(0, (MONTHLY_INCOME - totalSpent) / MONTHLY_INCOME),
  }
}
