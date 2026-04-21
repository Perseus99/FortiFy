import { chatWithHistory } from '@/lib/claude'
import type { NPCMessage, NPCContext } from './npc'

const SYSTEM_PROMPT = (ctx: NPCContext) => {
  const h = ctx.playerHistory
  const income = ctx.totalIncome ?? 0

  // Recommended allocations (50/30/20 variant adjusted for categories)
  const rec: Record<string, number> = income > 0 ? {
    food:          Math.round(income * 0.12),
    transport:     Math.round(income * 0.10),
    utilities:     Math.round(income * 0.08),
    subscriptions: Math.round(income * 0.05),
    entertainment: Math.round(income * 0.07),
    shopping:      Math.round(income * 0.08),
  } : {}

  const overAllocated = income > 0
    ? Object.entries(ctx.categories)
        .filter(([cat, amt]) => rec[cat] && Number(amt) > rec[cat])
        .map(([cat, amt]) => `${cat} ($${Number(amt).toFixed(0)} vs $${rec[cat]} budget)`)
    : []

  const historyBlock = h && h.weeksTracked > 0 ? `
Supply record (${h.weeksTracked} weeks):
- Allocation efficiency: ${h.scoreTrend}
- Most over-allocated category historically: ${h.worstCategory ?? 'none identified'}
- ${h.lastGoalMet ? 'Last resupply mission: successful' : 'Last resupply mission: failed — reallocation required'}` : ''

  return `You are The Quartermaster — a no-nonsense supply officer in a tower defense game called FortifyFi.
Personality: pragmatic, allocation-obsessed, blunt. Every coin is a resource that needs an assignment. Waste is a tactical error.
Use military logistics and supply chain metaphors. Refer to yourself as "The Quartermaster". Never say "I".

Your specialty: budget allocation by category, identifying over-deployed resources, recommending rebalancing. You speak in budgets and percentages.

Current supply audit:
- Total income (supply): ${income > 0 ? `$${income.toFixed(0)}` : 'UNKNOWN — cannot allocate without supply data'}
- Total deployed: $${ctx.totalSpent.toFixed(0)}${income > 0 ? ` (${((ctx.totalSpent/income)*100).toFixed(0)}% of supply)` : ''}
- Category deployment: ${Object.entries(ctx.categories).sort(([,a],[,b]) => b-a).map(([k,v]) => `${k}: $${Number(v).toFixed(0)}${income > 0 ? ` (${((Number(v)/income)*100).toFixed(0)}%)` : ''}`).join(', ')}
${overAllocated.length > 0 ? `- Over-budget positions: ${overAllocated.join('; ')}` : '- No categories exceed recommended allocation'}
${income > 0 ? `- Recommended max allocations: ${Object.entries(rec).map(([k,v]) => `${k}: $${v}`).join(', ')}` : ''}
${historyBlock}
Rules: under 80 words. Be specific — name categories and dollar amounts. Tell the player exactly what to move and where. Plain text only — no markdown, no asterisks, no bold.`
}

function fallback(ctx: NPCContext): string {
  const income = ctx.totalIncome ?? 0
  if (income === 0) return `The Quartermaster cannot allocate without knowing the supply. Log income transactions to unlock budget planning.`
  const topCat = Object.entries(ctx.categories).sort(([,a],[,b]) => b-a)[0]
  const pct = topCat ? ((Number(topCat[1]) / income) * 100).toFixed(0) : '?'
  return `Supply audit complete. ${topCat ? `${topCat[0]} consuming ${pct}% of income ($${Number(topCat[1]).toFixed(0)}) — over-deployed.` : ''} Reallocate surplus to reserves. Target: no single category above 15% of income.`
}

export async function runQuartermasterAgent(messages: NPCMessage[], context: NPCContext): Promise<string> {
  try {
    return await chatWithHistory(SYSTEM_PROMPT(context), messages)
  } catch {
    return fallback(context)
  }
}
