import { runWardenAgent } from './warden'
import { runScoutAgent } from './scout'
import { runArchitectAgent } from './architect'
import { runQuartermasterAgent } from './quartermaster'
import { runMedicAgent } from './medic'
import type { PlayerContext } from './contextAgent'

export type NPCType = 'warden' | 'scout' | 'architect' | 'quartermaster' | 'medic'

export interface NPCMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface NPCContext {
  totalSpent: number
  goalAmount: number
  score: number
  savingsRate?: number
  totalIncome?: number
  categories: Record<string, number>
  flaggedTransactions: { merchant: string; amount: number; flag_reason: string | null }[]
  playerHistory?: PlayerContext
  gameResult?: { won: boolean; points: number; cityHealth: number }
}

export async function runNPCAgent(
  npcType: NPCType,
  messages: NPCMessage[],
  context: NPCContext
): Promise<string> {
  switch (npcType) {
    case 'warden':       return runWardenAgent(messages, context)
    case 'scout':        return runScoutAgent(messages, context)
    case 'architect':    return runArchitectAgent(messages, context)
    case 'quartermaster': return runQuartermasterAgent(messages, context)
    case 'medic':        return runMedicAgent(messages, context)
  }
}
