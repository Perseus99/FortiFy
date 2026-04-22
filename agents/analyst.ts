import { createAuthClient } from '@/lib/supabase'
import { VALID_CATEGORIES } from '@/lib/types'
import type { FinancialProfile, SpendingCategory, Transaction } from '@/lib/types'

export async function runAnalystAgent(
  userId: string, token: string, sinceDate?: string
): Promise<FinancialProfile> {
  const db = createAuthClient(token)

  let query = db.from('transactions').select('*').eq('user_id', userId)
  if (sinceDate) query = query.gte('transaction_date', sinceDate)
  const { data: txns } = await query
  const purchases = txns ?? []

  const incomeTotal = purchases
    .filter((t: any) => t.category === 'income')
    .reduce((s: number, t: any) => s + Number(t.amount), 0)

  const totalIncome = incomeTotal > 0 ? incomeTotal : 5600

  const spending = purchases.filter((t: any) => t.category !== 'income')

  const categories = Object.fromEntries(VALID_CATEGORIES.map(c => [c, 0])) as Record<SpendingCategory, number>
  for (const t of spending) {
    if (t.category && t.category in categories)
      categories[t.category as SpendingCategory] += Number(t.amount)
  }

  const totalSpent    = spending.reduce((s: number, t: any) => s + Number(t.amount), 0)
  const savings_rate  = Math.max(0, (totalIncome - totalSpent) / Math.max(totalIncome, 1))

  return {
    total_spent:          totalSpent,
    total_income:         totalIncome,
    categories,
    flagged_transactions: spending.filter((t: any) => t.flagged) as Transaction[],
    savings_rate,
  }
}
