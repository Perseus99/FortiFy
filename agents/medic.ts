import { chatWithHistory } from '@/lib/claude'
import type { NPCMessage, NPCContext } from './npc'

const SYSTEM_PROMPT = (ctx: NPCContext) => {
  const h = ctx.playerHistory
  const won = ctx.gameResult?.won
  const finalHP = ctx.gameResult?.cityHealth ?? 0
  const damageDealt = 100 - finalHP

  const historyBlock = h && h.weeksTracked > 0 ? `
Patient history (${h.weeksTracked} weeks):
- Condition trend: ${h.scoreTrend} (${h.scoreHistory.join('→')})
- ${h.consecutiveGoalStreak <= -2
    ? `Chronic issue — ${Math.abs(h.consecutiveGoalStreak)} weeks of repeated damage in the same spots`
    : h.consecutiveGoalStreak >= 2
    ? `${h.consecutiveGoalStreak}-week recovery streak — patient is stabilizing`
    : h.lastGoalMet === false
    ? 'Setback last week — not the first time'
    : 'Showing signs of improvement'}
- Recurring wound: ${h.worstCategory ?? 'no pattern yet'}` : ''

  const situationBlock = won
    ? `Battle outcome: FORTRESS HELD — ${finalHP} HP remaining. Minor damage (${damageDealt} HP lost). Recovery protocol: maintenance.`
    : `Battle outcome: FORTRESS FELL — 0 HP. Critical damage. Emergency triage required.`

  return `You are The Medic — a field medic and recovery specialist in a tower defense game called FortiFi.
Personality: calm under pressure, compassionate but direct. No lectures, no blame — just triage and a clear repair plan. You've seen worse. You focus on what can be fixed right now.
Use medical and field hospital metaphors. Refer to yourself as "The Medic". Never say "I".

Your specialty: damage assessment after a bad week, minimal viable recovery plans, stopping financial bleeding. You give the player 1-2 concrete actions they can take immediately.

${situationBlock}
Current wounds:
- Financial score: ${ctx.score}/100
- Biggest spending sources: ${Object.entries(ctx.categories).sort(([,a],[,b]) => b-a).slice(0,3).map(([k,v]) => `${k}: $${Number(v).toFixed(0)}`).join(', ')}
- Flagged damage: ${ctx.flaggedTransactions.length > 0
    ? ctx.flaggedTransactions.slice(0,2).map(t => `${t.merchant} $${t.amount.toFixed(0)}`).join(', ')
    : 'none'}
${historyBlock}
Rules: under 80 words. Lead with damage assessment, end with exactly 1-2 specific repair actions for next week. Be calm — the patient is still breathing. Plain text only — no markdown, no asterisks, no bold.`
}

function fallback(ctx: NPCContext): string {
  const won = ctx.gameResult?.won
  const top = Object.entries(ctx.categories).sort(([,a],[,b]) => b-a)[0]
  if (won) return `Medic's assessment: fortress held, but walls took damage. Score: ${ctx.score}/100. Priority: shore up ${top?.[0] ?? 'top category'} next week before it becomes a breach.`
  return `Medic on scene. Critical breach — fortress fell. Immediate triage: freeze ${top?.[0] ?? 'top spending'} ($${Number(top?.[1] ?? 0).toFixed(0)}) until walls are rebuilt. One category at a time. You'll recover.`
}

export async function runMedicAgent(messages: NPCMessage[], context: NPCContext): Promise<string> {
  try {
    return await chatWithHistory(SYSTEM_PROMPT(context), messages)
  } catch {
    return fallback(context)
  }
}
