import { chatWithHistory } from '@/lib/claude'
import type { NPCMessage, NPCContext } from './npc'

const SYSTEM_PROMPT = (ctx: NPCContext) => {
  const h = ctx.playerHistory
  const historyBlock = h && h.weeksTracked > 0 ? `
Historical surveillance (${h.weeksTracked} weeks):
- Pattern: ${h.scoreTrend} performance (${h.scoreHistory.join('→')})
- ${h.worstCategory
    ? `${h.worstCategory} is the repeat offender across multiple cycles`
    : 'No repeat category flagged yet'}
- ${h.consecutiveGoalStreak <= -2
    ? `Target has missed goals ${Math.abs(h.consecutiveGoalStreak)} weeks straight — escalating risk`
    : h.consecutiveGoalStreak >= 2
    ? `${h.consecutiveGoalStreak}-week compliance streak — but complacency breeds blind spots`
    : h.lastGoalMet === false
    ? 'Last week\'s goal was not achieved — note the pattern'
    : 'Last week\'s goal was achieved'}` : ''

  return `You are The Scout — a sharp-eyed spending investigator in a tower defense game called FortiFi.
Personality: precise, a little conspiratorial, always watching. You deliver field reports, not lectures.
Use reconnaissance and surveillance metaphors. Refer to yourself as "The Scout". Never say "I".

Your specialty: spotting suspicious transactions, subscription creep, and recurring charges the player forgot about.
You name merchants specifically. You connect patterns across transactions — including week-over-week repeats. You make the player feel watched (in a helpful way).

Current cycle intel:
- Flagged transactions (${ctx.flaggedTransactions.length}): ${ctx.flaggedTransactions.length > 0
    ? ctx.flaggedTransactions.map(t => `${t.merchant} $${Number(t.amount).toFixed(2)} — ${t.flag_reason ?? 'suspicious'}`).join(' | ')
    : 'none this cycle'}
- Subscription spend: $${Number(ctx.categories['subscriptions'] ?? 0).toFixed(2)}
- Recurring risk score: ${ctx.flaggedTransactions.filter(t => t.flag_reason?.toLowerCase().includes('recurring')).length} recurring patterns detected
- Weekly score: ${ctx.score}/100
${historyBlock}
Rules: under 80 words. Name specific merchants. Reference historical patterns when available. Be investigative and concrete. Plain text only — no markdown, no asterisks, no bold.`
}

function fallback(ctx: NPCContext): string {
  const flagCount = ctx.flaggedTransactions.length
  const recurring = ctx.flaggedTransactions.filter(t => t.flag_reason?.toLowerCase().includes('recurring'))
  if (flagCount > 0) {
    const first = ctx.flaggedTransactions[0]
    return `Scout reporting. ${flagCount} transaction${flagCount > 1 ? 's' : ''} flagged. Primary target: ${first.merchant} — ${first.flag_reason ?? 'unusual pattern'}. ${recurring.length > 0 ? `${recurring.length} recurring charge${recurring.length > 1 ? 's' : ''} detected. Review and cancel what you don't use.` : 'Recommend review before next engagement.'}`
  }
  return `Scout reporting. No flagged transactions this cycle. Subscription exposure: $${Number(ctx.categories['subscriptions'] ?? 0).toFixed(2)}. Score: ${ctx.score}/100. Perimeter clean — for now.`
}

export async function runScoutAgent(messages: NPCMessage[], context: NPCContext): Promise<string> {
  try {
    return await chatWithHistory(SYSTEM_PROMPT(context), messages)
  } catch {
    return fallback(context)
  }
}
