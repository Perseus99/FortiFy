import { createAuthClient } from '@/lib/supabase'
import type { WaveConfig } from '@/lib/types'

function scoreToWaveParams(score: number) {
  if (score >= 80) return { enemy_count: 8,  enemy_speed: 0.8, enemy_hp: 60,  spawn_rate: 2.5, bonus_tower: 'cannon' }
  if (score >= 50) return { enemy_count: 14, enemy_speed: 1.2, enemy_hp: 100, spawn_rate: 1.8, bonus_tower: null }
  return              { enemy_count: 20, enemy_speed: 1.6, enemy_hp: 150, spawn_rate: 1.2, bonus_tower: null }
}

export async function runGameEngineAgent(
  userId: string,
  score: number,
  weekNumber: number,
  token: string,
  goalBonus: { points: number; health: number } = { points: 0, health: 0 }
): Promise<WaveConfig> {
  const db = createAuthClient(token)
  const params = scoreToWaveParams(score)

  const { data, error } = await db
    .from('wave_config')
    .upsert(
      { user_id: userId, week_number: weekNumber, financial_score: score, ...params },
      { onConflict: 'user_id,week_number' }
    )
    .select()
    .single()

  if (error) throw new Error(`Game engine agent failed: ${error.message}`)

  const pointsEarned    = Math.floor(score * 1.5) + goalBonus.points
  const cityHealthBonus = (score >= 80 ? 10 : score >= 50 ? 0 : -15) + goalBonus.health

  await db.rpc('update_game_state', {
    p_user_id:      userId,
    p_points_delta: pointsEarned,
    p_health_delta: cityHealthBonus,
    p_week_number:  weekNumber,
  })

  return data as WaveConfig
}
