import { createAuthClient } from '@/lib/supabase'
import type { FinancialProfile, SpendingCategory, Transaction } from '@/lib/types'

function calculateScore(totalSpent: number, totalIncome: number, goalAmount: number): number {
  const withinGoal = totalSpent <= goalAmount ? 1 : goalAmount / totalSpent
  const savingsRate = Math.max(0, (totalIncome - totalSpent) / Math.max(totalIncome, 1))
  return Math.max(0, Math.min(100, Math.round((savingsRate * 0.4 + withinGoal * 0.6) * 100)))
}

export async function runAnalystAgent(
  userId: string, goalAmount: number, token: string
): Promise<FinancialProfile> {
  const db = createAuthClient(token)

  const { data: txns } = await db.from('transactions').select('*').eq('user_id', userId)
  const purchases = txns ?? []

  const incomeTotal = purchases
    .filter((t: any) => t.category === 'income')
    .reduce((s: number, t: any) => s + Number(t.amount), 0)

  const totalIncome = incomeTotal > 0 ? incomeTotal : 5600  // fallback if no income txns seeded yet

  const spending = purchases.filter((t: any) => t.category !== 'income')

  const categories: Record<SpendingCategory, number> = {
    food: 0, subscriptions: 0, shopping: 0, transport: 0, entertainment: 0, utilities: 0, other: 0,
  }
  for (const t of spending) {
    if (t.category && t.category in categories)
      categories[t.category as SpendingCategory] += Number(t.amount)
  }

  const totalSpent = spending.reduce((s: number, t: any) => s + Number(t.amount), 0)
  const score = calculateScore(totalSpent, totalIncome, goalAmount)

  // Goal closing (completed flag + actual_spent) is handled by weekly-loop with week-specific date
  // filtering — analyst only computes the financial profile and score

  return {
    score,
    total_spent:          totalSpent,
    total_income:         totalIncome,
    categories,
    flagged_transactions: spending.filter((t: any) => t.flagged) as Transaction[],
    savings_rate:         Math.max(0, (totalIncome - totalSpent) / Math.max(totalIncome, 1)),
  }
}
