import { chat } from '@/lib/claude'
import { getPurchases, getDeposits } from '@/lib/nessie'
import { createAuthClient } from '@/lib/supabase'
import type { FinancialProfile, SpendingCategory, Transaction } from '@/lib/types'

const SYSTEM_PROMPT = `You are a financial analyst agent. You will be given a list of transactions and must:
1. Categorize each transaction into one of: food, subscriptions, shopping, transport, entertainment, utilities, other
2. Identify flagged transactions (wasteful, risky, or recurring charges the user may have forgotten)
3. Return ONLY valid JSON with no explanation.

Response format:
{
  "categories": { "food": 0, "subscriptions": 0, "shopping": 0, "transport": 0, "entertainment": 0, "utilities": 0, "other": 0 },
  "flagged": [{ "merchant": "...", "reason": "..." }]
}`

function keywordCategory(merchant: string): SpendingCategory {
  const m = merchant.toLowerCase()
  if (/netflix|spotify|hulu|disney|apple\s*tv|prime\s*video|subscription|patreon|adobe|duolingo/.test(m)) return 'subscriptions'
  if (/restaurant|cafe|coffee|bakery|kitchen|pizza|burger|sushi|food|doordash|grubhub|ubereats|starbucks|chipotle|mcdonald|grill|diner|bistro|eatery|taco|sandwich|noodle|ramen|sushi|thai|chinese|indian|bbq|bar\s*&\s*grill|tavern|brewery|winery|vineyard/.test(m)) return 'food'
  if (/amazon|walmart|target|ebay|etsy|shop|store|market|mall|gift|book|dollar|costco|ikea|best\s*buy|home\s*depot/.test(m)) return 'shopping'
  if (/uber|lyft|metro|transit|gas|shell|chevron|bp|parking|taxi|train|bus|airline|delta|southwest/.test(m)) return 'transport'
  if (/movie|cinema|steam|game|ticket|concert|entertainment|netflix|hulu|theater|arcade|bowling|sport|gym|fitness/.test(m)) return 'entertainment'
  if (/electric|water|internet|phone|att|verizon|t-mobile|utility|bill|comcast|xfinity|spectrum|insurance/.test(m)) return 'utilities'
  return 'other'
}

function ruleBasedCategorize(purchases: any[]): {
  categories: Record<SpendingCategory, number>
  flagged: { merchant: string; reason: string }[]
} {
  const categories: Record<SpendingCategory, number> = {
    food: 0, subscriptions: 0, shopping: 0, transport: 0, entertainment: 0, utilities: 0, other: 0,
  }
  const flagged: { merchant: string; reason: string }[] = []

  for (const p of purchases) {
    const name = p.description || p.merchant_id || 'Unknown'
    const cat = keywordCategory(name)
    categories[cat] = (categories[cat] ?? 0) + p.amount
    if (cat === 'subscriptions') flagged.push({ merchant: name, reason: 'Recurring subscription charge' })
    else if (p.amount > 200) flagged.push({ merchant: name, reason: 'Unusually large purchase' })
  }

  return { categories, flagged }
}

function calculateScore(totalSpent: number, totalIncome: number, goalAmount: number): number {
  if (totalIncome === 0) return 50
  const savingsRate = (totalIncome - totalSpent) / totalIncome
  const withinGoal = totalSpent <= goalAmount ? 1 : goalAmount / totalSpent
  const raw = savingsRate * 0.5 + withinGoal * 0.5
  return Math.max(0, Math.min(100, Math.round(raw * 100)))
}

export async function runAnalystAgent(
  userId: string, accountId: string, goalAmount: number, token: string
): Promise<FinancialProfile> {
  const db = createAuthClient(token)

  const [purchases, deposits] = await Promise.all([
    getPurchases(accountId),
    getDeposits(accountId),
  ])

  const totalSpent: number  = purchases.reduce((sum: number, p: any) => sum + p.amount, 0)
  const totalIncome: number = deposits.reduce((sum: number, d: any) => sum + d.amount, 0)

  // Only send last 20 transactions to keep LLM response fast
  const recentPurchases = [...purchases].sort((a: any, b: any) =>
    new Date(b.purchase_date).getTime() - new Date(a.purchase_date).getTime()
  ).slice(0, 20)

  const transactionList = recentPurchases
    .map((p: any) => `${p.description || p.merchant_id}: $${p.amount} on ${p.purchase_date}`)
    .join('\n')

  let parsed: { categories: Record<SpendingCategory, number>; flagged: { merchant: string; reason: string }[] }
  try {
    const llmResponse = await chat(
      SYSTEM_PROMPT,
      `Analyze these transactions and return JSON:\n${transactionList}`
    )
    const jsonMatch = llmResponse.match(/\{[\s\S]*\}/)
    parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : ruleBasedCategorize(recentPurchases)
  } catch {
    parsed = ruleBasedCategorize(recentPurchases)
  }

  const score = calculateScore(totalSpent, totalIncome, goalAmount)

  const transactionRows = purchases.map((p: any) => {
    const merchant = p.description || p.merchant_id || 'Unknown'
    return {
      user_id: userId,
      nessie_id: p._id,
      amount: p.amount,
      merchant,
      transaction_date: p.purchase_date,
      category: keywordCategory(merchant),
      flagged: parsed.flagged.some((f) => f.merchant === merchant),
      flag_reason: parsed.flagged.find((f) => f.merchant === merchant)?.reason ?? null,
    }
  })

  await db.from('transactions').delete().eq('user_id', userId)
  await db.from('transactions').insert(transactionRows)
  await db.from('weekly_goals')
    .update({ actual_spent: totalSpent, score, completed: true })
    .eq('user_id', userId)
    .eq('completed', false)

  const flaggedTransactions: Transaction[] = transactionRows
    .filter((t: typeof transactionRows[0]) => t.flagged)
    .map((t: typeof transactionRows[0]) => ({ ...t, id: '', created_at: '' }))

  return {
    score,
    total_spent: totalSpent,
    total_income: totalIncome,
    categories: parsed.categories as Record<SpendingCategory, number>,
    flagged_transactions: flaggedTransactions,
    savings_rate: totalIncome > 0 ? (totalIncome - totalSpent) / totalIncome : 0,
  }
}
