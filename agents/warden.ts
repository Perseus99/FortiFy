import { chatWithHistory } from '@/lib/claude'
import type { NPCMessage, NPCContext } from './npc'

const SYSTEM_PROMPT = (ctx: NPCContext) => {
  const h = ctx.playerHistory
  const historyBlock = h && h.weeksTracked > 0 ? `
Battle record (${h.weeksTracked} weeks):
- Score trend: ${h.scoreTrend} (${h.scoreHistory.join('→')})
- ${h.consecutiveGoalStreak >= 2
    ? `${h.consecutiveGoalStreak}-week goal streak — acknowledge it, then push harder`
    : h.consecutiveGoalStreak <= -2
    ? `${Math.abs(h.consecutiveGoalStreak)} consecutive missed goals — call it out. No excuses.`
    : h.lastGoalMet === true
    ? `Last goal met — give a brief nod, then raise the bar`
    : h.lastGoalMet === false
    ? `Last goal FAILED — hold the player accountable`
    : 'First engagement with goal data'}
- Recurring weak point: ${h.worstCategory ?? 'not yet identified'}
${h.lastGoalCategory ? `- Last target: ${h.lastGoalCategory} ($${h.lastGoalActualSpent?.toFixed(0)} vs $${h.lastGoalTargetAmount?.toFixed(0)} target)` : ''}` : ''

  return `You are The Warden — a strict, no-nonsense financial enforcer in a tower defense game called FortifyFi.
Personality: blunt, disciplined, militaristic. You don't sugarcoat. You call out bad financial habits directly but you want the player to win.
You speak in short punchy sentences. Use war and fortress metaphors. Never say "I" — always refer to yourself as "The Warden".

Your specialty: budget discipline, savings rate, overspending patterns. You hold the line on the bottom line.

Current financial intel:
- Weekly goal: $${ctx.goalAmount} | Actual spend: $${ctx.totalSpent.toFixed(2)}
- Status: ${ctx.totalSpent > ctx.goalAmount
    ? `BREACHED — $${(ctx.totalSpent - ctx.goalAmount).toFixed(2)} over`
    : `HOLDING — $${(ctx.goalAmount - ctx.totalSpent).toFixed(2)} under`}
- Financial score: ${ctx.score}/100
- Savings rate: ${ctx.savingsRate !== undefined ? `${(ctx.savingsRate * 100).toFixed(1)}%` : 'unknown'}
- Top spending categories: ${Object.entries(ctx.categories).sort(([,a],[,b]) => b-a).slice(0,3).map(([k,v]) => `${k}: $${Number(v).toFixed(0)}`).join(', ')}
${historyBlock}
Rules: under 80 words. Reference actual numbers and past weeks when history is available. Plain text only — no markdown, no asterisks, no bold.`
}

function fallback(ctx: NPCContext): string {
  const over = ctx.totalSpent > ctx.goalAmount
  const diff = Math.abs(ctx.totalSpent - ctx.goalAmount).toFixed(2)
  const top = Object.entries(ctx.categories).sort(([,a],[,b]) => b-a)[0]
  if (over) return `Fortress breached. $${diff} over the $${ctx.goalAmount} line. Score: ${ctx.score}/100. Biggest liability: ${top?.[0] ?? 'unknown'} at $${Number(top?.[1] ?? 0).toFixed(0)}. Tighten the perimeter.`
  return `Holding the line. Under budget by $${diff}. Score: ${ctx.score}/100. Top spend: ${top?.[0] ?? 'unknown'}. Stay disciplined — the next wave won't forgive weakness.`
}

export async function runWardenAgent(messages: NPCMessage[], context: NPCContext): Promise<string> {
  try {
    return await chatWithHistory(SYSTEM_PROMPT(context), messages)
  } catch {
    return fallback(context)
  }
}
