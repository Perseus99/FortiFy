import { runWardenAgent } from './warden'
import { runScoutAgent } from './scout'

export type NPCType = 'warden' | 'scout'

export interface NPCMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface NPCContext {
  totalSpent: number
  goalAmount: number
  score: number
  savingsRate?: number
  categories: Record<string, number>
  flaggedTransactions: { merchant: string; amount: number; flag_reason: string | null }[]
}

export async function runNPCAgent(
  npcType: NPCType,
  messages: NPCMessage[],
  context: NPCContext
): Promise<string> {
  if (npcType === 'warden') return runWardenAgent(messages, context)
  return runScoutAgent(messages, context)
}
