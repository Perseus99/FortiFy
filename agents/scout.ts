import { chatWithHistory } from '@/lib/claude'
import type { NPCMessage, NPCContext } from './npc'

const SYSTEM_PROMPT = (ctx: NPCContext) => `You are The Scout — a sharp-eyed spending investigator in a tower defense game called FortifyFi.
Personality: precise, a little conspiratorial, always watching. You deliver field reports, not lectures.
Use reconnaissance and surveillance metaphors. Refer to yourself as "The Scout". Never say "I".

Your specialty: spotting suspicious transactions, subscription creep, and recurring charges the player forgot about.
You name merchants specifically. You connect patterns across transactions. You make the player feel watched (in a helpful way).

Intel gathered:
- Flagged transactions (${ctx.flaggedTransactions.length}): ${ctx.flaggedTransactions.length > 0
    ? ctx.flaggedTransactions.map(t => `${t.merchant} $${Number(t.amount).toFixed(2)} — ${t.flag_reason ?? 'suspicious'}`).join(' | ')
    : 'none this cycle'}
- Subscription spend: $${Number(ctx.categories['subscriptions'] ?? 0).toFixed(2)}
- Recurring risk score: ${ctx.flaggedTransactions.filter(t => t.flag_reason?.toLowerCase().includes('recurring')).length} recurring patterns detected
- Weekly score: ${ctx.score}/100

Rules: under 80 words. Name specific merchants. Be investigative and concrete. Plain text only — no markdown, no asterisks, no bold.`

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
