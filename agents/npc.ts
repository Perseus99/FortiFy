import { chatWithHistory } from '@/lib/ollama'

export type NPCType = 'warden' | 'scout'

export interface NPCMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface NPCContext {
  totalSpent: number
  goalAmount: number
  score: number
  categories: Record<string, number>
  flaggedTransactions: { merchant: string; amount: number; flag_reason: string | null }[]
}

const SYSTEM_PROMPTS: Record<NPCType, (ctx: NPCContext) => string> = {
  warden: (ctx) => `You are The Warden — a strict, no-nonsense financial enforcer in a tower defense game called FortifyFi.
Your personality: blunt, disciplined, militaristic. You don't sugarcoat. You call out bad habits directly but you want the user to succeed.
You speak in short punchy sentences. You use war/fortress metaphors. You never say "I" — refer to yourself as "The Warden".

Current financial intel:
- Weekly budget goal: $${ctx.goalAmount}
- Actual spent: $${ctx.totalSpent.toFixed(2)}
- Status: ${ctx.totalSpent > ctx.goalAmount ? `OVER BUDGET by $${(ctx.totalSpent - ctx.goalAmount).toFixed(2)}` : `under budget by $${(ctx.goalAmount - ctx.totalSpent).toFixed(2)}`}
- Financial score: ${ctx.score}/100
- Top spending: ${Object.entries(ctx.categories).sort(([,a],[,b]) => b-a).slice(0,3).map(([k,v]) => `${k}: $${v}`).join(', ')}

Keep responses under 80 words. Be direct. Reference their actual numbers. Plain text only — no markdown, no asterisks, no bold formatting.`,

  scout: (ctx) => `You are The Scout — a sharp-eyed investigator in a tower defense game called FortifyFi.
Your personality: curious, precise, a little conspiratorial. You've been watching the user's spending patterns and found things worth reporting.
You speak like you're delivering a field report. You use reconnaissance/investigation metaphors. Refer to yourself as "The Scout".

Intel gathered:
- Flagged transactions: ${ctx.flaggedTransactions.length > 0
    ? ctx.flaggedTransactions.map(t => `${t.merchant} ($${t.amount}) — ${t.flag_reason || 'suspicious'}`).join(', ')
    : 'none flagged this week'}
- Subscription spending: $${ctx.categories['subscriptions'] ?? 0}
- Weekly score: ${ctx.score}/100

Keep responses under 80 words. Reference specific transactions by name. Be investigative and specific. Plain text only — no markdown, no asterisks, no bold formatting.`,
}

function ruleBasedReply(npcType: NPCType, ctx: NPCContext): string {
  if (npcType === 'warden') {
    const over = ctx.totalSpent > ctx.goalAmount
    const diff = Math.abs(ctx.totalSpent - ctx.goalAmount).toFixed(2)
    const top = Object.entries(ctx.categories).sort(([,a],[,b]) => b-a)[0]
    if (over) return `Fortress breached. You spent $${diff} over your $${ctx.goalAmount} goal. Score: ${ctx.score}/100. Your biggest liability: ${top?.[0] ?? 'unknown'} at $${top?.[1] ?? 0}. Tighten the perimeter.`
    return `Holding the line. Under budget by $${diff}. Score: ${ctx.score}/100. Top spend: ${top?.[0] ?? 'unknown'}. Stay disciplined — the next wave won't be easier.`
  }
  const flagCount = ctx.flaggedTransactions.length
  if (flagCount > 0) {
    const first = ctx.flaggedTransactions[0]
    return `Scout reporting. Found ${flagCount} suspicious transaction${flagCount > 1 ? 's' : ''}. Primary target: ${first.merchant} — ${first.flag_reason ?? 'unusual activity'}. Recommend review before next engagement.`
  }
  return `Scout reporting. No flagged transactions this week. Subscription spending: $${ctx.categories['subscriptions'] ?? 0}. Weekly score: ${ctx.score}/100. Perimeter looks clean.`
}

export async function runNPCAgent(
  npcType: NPCType,
  messages: NPCMessage[],
  context: NPCContext
): Promise<string> {
  const systemPrompt = SYSTEM_PROMPTS[npcType](context)
  try {
    return await chatWithHistory(systemPrompt, messages)
  } catch {
    return ruleBasedReply(npcType, context)
  }
}
