export type Profile = {
  id: string
  email: string | null
  nessie_customer_id: string | null
  nessie_account_id: string | null
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
  nessie_id: string | null
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

export type SpendingCategory =
  | 'food'
  | 'subscriptions'
  | 'shopping'
  | 'transport'
  | 'entertainment'
  | 'utilities'
  | 'other'

export type FinancialProfile = {
  score: number
  total_spent: number
  total_income: number
  categories: Record<SpendingCategory, number>
  flagged_transactions: Transaction[]
  savings_rate: number
}
