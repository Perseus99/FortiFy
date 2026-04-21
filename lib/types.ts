export type Profile = {
  id: string
  email: string | null
  created_at: string
}

export type GameState = {
  id: string
  user_id: string
  points: number
  city_health: number
  week_number: number
  level: number
  towers_placed: TowerPlacement[]
  updated_at: string
}

export type TowerPlacement = {
  type: 'archer' | 'cannon'
  cell: number
}

export type WeeklyGoal = {
  id: string
  user_id: string
  week_start_date: string
  goal_amount: number
  actual_spent: number
  score: number
  completed: boolean
  goal_category: string | null
  goal_label: string | null
  created_at: string
}

export type Transaction = {
  id: string
  user_id: string
  amount: number
  category: string | null
  merchant: string | null
  transaction_date: string | null
  flagged: boolean
  flag_reason: string | null
  created_at: string
}

export type WaveConfig = {
  id: string
  user_id: string
  week_number: number
  financial_score: number
  enemy_count: number
  enemy_speed: number
  enemy_hp: number
  spawn_rate: number
  bonus_tower: string | null
  created_at: string
}

export const VALID_CATEGORIES = [
  'food', 'subscriptions', 'shopping', 'transport', 'entertainment', 'utilities', 'other',
] as const

export type SpendingCategory = typeof VALID_CATEGORIES[number]

export const VALID_PERIODS = ['week1', 'week1half', 'week2'] as const
export type Period = typeof VALID_PERIODS[number]

export interface ParsedTxn {
  merchant: string
  amount: number
  category: string
  flagged: boolean
  flag_reason: string | null
}

export type FinancialProfile = {
  score: number
  total_spent: number
  total_income: number
  categories: Record<SpendingCategory, number>
  flagged_transactions: Transaction[]
  savings_rate: number
}
