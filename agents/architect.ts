import { chatWithHistory } from '@/lib/claude'
import type { NPCMessage, NPCContext } from './npc'

const SYSTEM_PROMPT = (ctx: NPCContext) => {
  const h = ctx.playerHistory
  const income = ctx.totalIncome ?? 0
  const savingsAmt = income > 0 ? income - ctx.totalSpent : 0
  const savingsRate = income > 0 ? (savingsAmt / income) * 100 : 0
  const runway = savingsAmt > 0 ? (savingsAmt / ctx.totalSpent).toFixed(1) : '0'

  const historyBlock = h && h.weeksTracked > 0 ? `
Blueprint history (${h.weeksTracked} weeks):
- Structural trend: ${h.scoreTrend} (${h.scoreHistory.join('→')})
- ${h.consecutiveGoalStreak >= 2
    ? `${h.consecutiveGoalStreak}-week streak of hitting targets — the foundation is holding`
    : h.consecutiveGoalStreak <= -2
    ? `${Math.abs(h.consecutiveGoalStreak)} consecutive missed targets — the structure is compromised`
    : h.lastGoalMet ? 'Last week\'s plan executed — build on it'
    : 'Last week\'s plan failed — redesign required'}
- Structural weak point: ${h.worstCategory ?? 'not yet mapped'}` : ''

  return `You are The Architect — a calm, precise savings strategist in a tower defense game called FortiFi.
Personality: methodical, forward-thinking, blueprint-obsessed. You think in structures, foundations, and long-term plans. Never reactive — always building.
Use construction and architecture metaphors. Refer to yourself as "The Architect". Never say "I".

Your specialty: savings rate, income allocation, financial runway, emergency fund, long-term structural health.
You don't dwell on past mistakes — you redesign from the current state and build forward.

Current blueprint:
- Income this period: ${income > 0 ? `$${income.toFixed(0)}` : 'unknown — income data missing'}
- Total spent: $${ctx.totalSpent.toFixed(0)}
- Savings this period: ${savingsAmt > 0 ? `$${savingsAmt.toFixed(0)} (${savingsRate.toFixed(1)}% rate)` : savingsAmt < 0 ? `negative — spending exceeds income` : 'breakeven'}
- Financial runway: ${income > 0 ? `${runway}× monthly expenses` : 'incalculable without income data'}
- Allocation by category: ${Object.entries(ctx.categories).sort(([,a],[,b]) => b-a).slice(0,4).map(([k,v]) => `${k} ${((Number(v)/Math.max(ctx.totalSpent,1))*100).toFixed(0)}%`).join(', ')}
${historyBlock}
Rules: under 80 words. Be specific with numbers. Focus on what to BUILD next, not what went wrong. Plain text only — no markdown, no asterisks, no bold.`
}

function fallback(ctx: NPCContext): string {
  const income = ctx.totalIncome ?? 0
  const saved = income > 0 ? income - ctx.totalSpent : 0
  const rate = income > 0 ? ((saved / income) * 100).toFixed(1) : '?'
  if (income === 0) return `The Architect needs income data to draw blueprints. Log your income transactions first — then the foundation can be designed.`
  if (saved <= 0) return `Blueprint assessment: spending exceeds income. Emergency redesign required. Cut the largest category first — every fortress needs load-bearing walls before decorations.`
  return `Savings rate: ${rate}%. Solid foundation. The Architect recommends targeting 20%+ for a resilient structure. Redirect surplus from ${Object.entries(ctx.categories).sort(([,a],[,b]) => b-a)[0]?.[0] ?? 'top category'} into reserves.`
}

export async function runArchitectAgent(messages: NPCMessage[], context: NPCContext): Promise<string> {
  try {
    return await chatWithHistory(SYSTEM_PROMPT(context), messages)
  } catch {
    return fallback(context)
  }
}
