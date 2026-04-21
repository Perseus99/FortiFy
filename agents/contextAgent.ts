import { createAuthClient } from '@/lib/supabase'

export interface PlayerContext {
  weeksTracked: number
  scoreHistory: number[]           // completed weeks oldest → newest
  scoreTrend: 'improving' | 'declining' | 'stable' | 'volatile'
  consecutiveGoalStreak: number    // >0 = weeks in a row met, <0 = weeks in a row missed
  worstCategory: string | null     // category with highest cumulative actual_spent across history
  lastGoalCategory: string | null
  lastGoalMet: boolean | null
  lastGoalActualSpent: number | null
  lastGoalTargetAmount: number | null
  summary: string                  // 1-2 sentence readable summary for LLM system prompts
}

export async function buildPlayerContext(userId: string, token: string): Promise<PlayerContext> {
  const db = createAuthClient(token)

  const { data: weeks } = await db.from('weekly_goals')
    .select('score, goal_category, goal_amount, actual_spent, week_start_date')
    .eq('user_id', userId)
    .eq('completed', true)
    .order('week_start_date', { ascending: true })
    .limit(8)

  const completed = weeks ?? []

  if (completed.length === 0) {
    return {
      weeksTracked: 0,
      scoreHistory: [],
      scoreTrend: 'stable',
      consecutiveGoalStreak: 0,
      worstCategory: null,
      lastGoalCategory: null,
      lastGoalMet: null,
      lastGoalActualSpent: null,
      lastGoalTargetAmount: null,
      summary: "No completed weeks yet — this is the player's first cycle.",
    }
  }

  const scoreHistory = completed.map(w => w.score ?? 0)

  // Trend: compare first-half average to second-half average
  const mid = Math.max(1, Math.floor(scoreHistory.length / 2))
  const avgFirst = scoreHistory.slice(0, mid).reduce((a, b) => a + b, 0) / mid
  const avgSecond = scoreHistory.slice(mid).reduce((a, b) => a + b, 0) / Math.max(1, scoreHistory.length - mid)
  const spread = Math.max(...scoreHistory) - Math.min(...scoreHistory)

  const scoreTrend: PlayerContext['scoreTrend'] =
    spread > 30               ? 'volatile'  :
    avgSecond - avgFirst > 8  ? 'improving' :
    avgFirst - avgSecond > 8  ? 'declining' :
    'stable'

  // Consecutive goal streak (newest first, stops at first direction change)
  let consecutiveGoalStreak = 0
  for (const w of [...completed].reverse()) {
    if (!w.goal_category || !w.goal_amount) break
    const met = (w.actual_spent ?? 0) <= w.goal_amount
    if (consecutiveGoalStreak === 0)         consecutiveGoalStreak = met ? 1 : -1
    else if (consecutiveGoalStreak > 0 && met)  consecutiveGoalStreak++
    else if (consecutiveGoalStreak < 0 && !met) consecutiveGoalStreak--
    else break
  }

  // Worst category by cumulative actual_spent across all completed weeks
  const catSpend: Record<string, number> = {}
  for (const w of completed) {
    if (w.goal_category)
      catSpend[w.goal_category] = (catSpend[w.goal_category] ?? 0) + (w.actual_spent ?? 0)
  }
  const worstCategory = Object.entries(catSpend).sort(([, a], [, b]) => b - a)[0]?.[0] ?? null

  const last = completed[completed.length - 1]
  const lastGoalMet = (last?.goal_category && last?.goal_amount != null)
    ? (last.actual_spent ?? 0) <= last.goal_amount
    : null

  // Human-readable summary for LLM system prompts
  const trendPhrase =
    scoreTrend === 'improving' ? 'Scores are trending up'         :
    scoreTrend === 'declining' ? 'Scores are trending down'       :
    scoreTrend === 'volatile'  ? 'Performance has been erratic'   :
                                 'Scores have been consistent'

  const streakPhrase =
    consecutiveGoalStreak >= 2  ? `on a ${consecutiveGoalStreak}-week goal streak`               :
    consecutiveGoalStreak <= -2 ? `missed goals ${Math.abs(consecutiveGoalStreak)} weeks running` :
    lastGoalMet === true        ? 'hit last week\'s goal'                                          :
    lastGoalMet === false       ? 'missed last week\'s goal'                                       :
                                  'no goal category history yet'

  const summary = `${completed.length} weeks tracked. ${trendPhrase} (${scoreHistory.join('→')}). Player ${streakPhrase}. Recurring problem area: ${worstCategory ?? 'not yet identified'}.`

  return {
    weeksTracked: completed.length,
    scoreHistory,
    scoreTrend,
    consecutiveGoalStreak,
    worstCategory,
    lastGoalCategory: last?.goal_category ?? null,
    lastGoalMet,
    lastGoalActualSpent: last?.actual_spent ?? null,
    lastGoalTargetAmount: last?.goal_amount ?? null,
    summary,
  }
}
