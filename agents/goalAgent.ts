import { chat } from '@/lib/ollama'

export interface GoalAgentInput {
  categories: Record<string, number>
  flaggedTransactions: { merchant: string; amount: number; flag_reason: string | null }[]
  totalSpent: number
  totalIncome: number
  excludedCategories?: string[]  // user-dismissed categories, skip these
}

export interface GoalOutput {
  goal_category: string
  goal_label: string
  goal_amount: number
  risk_reason: string
}

// Risk scoring: flags, subscriptions, and impulse categories carry more risk than raw spend
function scoreRisk(
  category: string,
  amount: number,
  flaggedTransactions: GoalAgentInput['flaggedTransactions'],
  totalSpent: number
): number {
  const flagsInCategory = flaggedTransactions.filter(t =>
    t.flag_reason?.toLowerCase().includes(category) ||
    (category === 'food' && !t.flag_reason?.toLowerCase().includes('subscription'))
  ).length

  const subscriptionPenalty = category === 'subscriptions' ? 40 : 0
  const impulsePenalty = ['shopping', 'entertainment'].includes(category) ? 20 : 0
  const flagPenalty = flagsInCategory * 25
  const spendShare = totalSpent > 0 ? (amount / totalSpent) * 30 : 0

  return subscriptionPenalty + impulsePenalty + flagPenalty + spendShare
}

function ruleBasedGoal(input: GoalAgentInput): GoalOutput {
  const { categories, flaggedTransactions, totalSpent, excludedCategories = [] } = input

  const categoryLabels: Record<string, string> = {
    food: 'food', subscriptions: 'subscriptions', shopping: 'shopping',
    transport: 'transport', entertainment: 'entertainment', utilities: 'utilities', other: 'other spending',
  }

  // Score each category by risk, skip user-dismissed ones
  const scored = Object.entries(categories)
    .filter(([cat, amt]) => Number(amt) > 0 && !excludedCategories.includes(cat))
    .map(([cat, amt]) => ({
      cat,
      amt: Number(amt),
      risk: scoreRisk(cat, Number(amt), flaggedTransactions, totalSpent),
    }))
    .sort((a, b) => b.risk - a.risk)

  const top = scored[0] ?? { cat: 'other', amt: 0, risk: 0 }
  const targetAmt = Math.round(top.amt * 0.75) // 25% reduction target for risky categories

  const riskReasons: Record<string, string> = {
    subscriptions: 'Recurring charges compound silently — easiest category to forget.',
    shopping: 'Impulse purchases spike here. High variance, low necessity.',
    entertainment: 'Discretionary spend — first place to cut when the fortress is under threat.',
    food: 'Frequent small purchases add up faster than you think.',
    transport: 'Worth auditing for unnecessary trips or ride-share overuse.',
    utilities: 'Check for duplicate or unused service charges.',
    other: 'Uncategorized spend is often the hardest to audit.',
  }

  return {
    goal_category: top.cat,
    goal_label: `Cut ${categoryLabels[top.cat] ?? top.cat} from $${Math.round(top.amt)} → $${targetAmt} (risk target)`,
    goal_amount: targetAmt,
    risk_reason: riskReasons[top.cat] ?? 'High risk category identified.',
  }
}

export async function runGoalAgent(input: GoalAgentInput): Promise<GoalOutput> {
  const { categories, flaggedTransactions, totalSpent, totalIncome, excludedCategories = [] } = input

  const categoryList = Object.entries(categories)
    .filter(([cat, v]) => Number(v) > 0 && !excludedCategories.includes(cat))
    .map(([k, v]) => `${k}: $${Number(v).toFixed(2)}`)
    .join(', ')

  const flagList = flaggedTransactions.length > 0
    ? flaggedTransactions.map(t => `${t.merchant} $${Number(t.amount).toFixed(2)} — ${t.flag_reason ?? 'suspicious'}`).join('; ')
    : 'none'

  const exclusionNote = excludedCategories.length > 0
    ? `\nUser has marked these categories as intentional — do NOT target them: ${excludedCategories.join(', ')}`
    : ''

  const prompt = `You are a financial risk analyst. Given a user's spending data, identify the RISKIEST spending category — not necessarily the largest. Risk factors: subscriptions (easy to forget, compound silently), flagged/suspicious transactions, impulse categories (shopping, entertainment), high frequency small purchases.

Spending by category: ${categoryList || 'none available'}
Flagged transactions: ${flagList}
Total spent: $${totalSpent.toFixed(2)} | Total income: $${totalIncome.toFixed(2)}${exclusionNote}

Return ONLY valid JSON, no explanation:
{
  "goal_category": "<category name>",
  "goal_label": "<one sentence goal like: Cut subscriptions from $85 → $60 (risk target)>",
  "goal_amount": <target dollar amount as integer>,
  "risk_reason": "<one sentence explaining why this category is risky>"
}`

  try {
    const response = await chat('You are a financial risk analyst. Return only valid JSON.', prompt)
    const match = response.match(/\{[\s\S]*\}/)
    if (!match) return ruleBasedGoal(input)
    const parsed = JSON.parse(match[0])
    if (!parsed.goal_category || !parsed.goal_label || !parsed.goal_amount) return ruleBasedGoal(input)
    return parsed as GoalOutput
  } catch {
    return ruleBasedGoal(input)
  }
}
