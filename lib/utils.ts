// Score = how well you met your specific category goal + savings rate
// withinGoal: 1.0 if under budget, scales down if over
// savingsRate: (income - totalSpend) / income
export function calculateScore(
  categorySpend: number,
  goalAmount: number,
  totalSpent: number,
  totalIncome: number,
): number {
  const withinGoal  = categorySpend <= goalAmount ? 1 : goalAmount / categorySpend
  const savingsRate = totalIncome > 0 ? Math.max(0, (totalIncome - totalSpent) / totalIncome) : 0
  return Math.max(0, Math.min(100, Math.round((withinGoal * 0.6 + savingsRate * 0.4) * 100)))
}

export function isoWeekStart(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const day = d.getUTCDay()
  d.setUTCDate(d.getUTCDate() - (day === 0 ? 6 : day - 1))
  return d.toISOString().split('T')[0]
}


export function weeksAgoMonday(n: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - n * 7)
  return isoWeekStart(d)
}

export function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}
