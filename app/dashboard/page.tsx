'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { GameState, WeeklyGoal, Transaction } from '@/lib/types'
import type { NPCType } from '@/agents/npc'
import NPCPopup from '@/components/npc/NPCPopup'

export default function DashboardPage() {
  const router = useRouter()
  const [userId, setUserId]       = useState<string | null>(null)
  const [email, setEmail]         = useState<string>('')
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [goal, setGoal]           = useState<WeeklyGoal | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading]     = useState(true)
  const [activeNPC, setActiveNPC] = useState<NPCType | null>(null)
  const [syncing, setSyncing]       = useState(false)
  const [syncMsg, setSyncMsg]       = useState('')
  const [needsSetup, setNeedsSetup] = useState(false)
  const [dismissing, setDismissing] = useState(false)
  const [allWeeks, setAllWeeks]     = useState<WeeklyGoal[]>([])
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)
      setEmail(user.email ?? '')

      const [{ data: profile }, { data: gs }, { data: wg }, { data: txns }, { data: weeks }] = await Promise.all([
        supabase.from('profiles').select('nessie_account_id').eq('id', user.id).single(),
        supabase.from('game_state').select('*').eq('user_id', user.id).single(),
        supabase.from('weekly_goals').select('*').eq('user_id', user.id).eq('completed', false)
          .order('created_at', { ascending: false }).limit(1).single(),
        supabase.from('transactions').select('*').eq('user_id', user.id)
          .order('transaction_date', { ascending: false }).limit(20),
        supabase.from('weekly_goals').select('*').eq('user_id', user.id)
          .order('week_start_date', { ascending: false }).limit(4),
      ])

      if (!profile?.nessie_account_id) setNeedsSetup(true)
      if (gs) { setGameState(gs); setSelectedWeek(gs.week_number) }
      if (wg) setGoal(wg)
      if (txns) setTransactions(txns)
      if (weeks) setAllWeeks(weeks)
      setLoading(false)
    }
    load()
  }, [])

  async function handleSelectWeek(weekNum: number, weekGoal: WeeklyGoal) {
    if (!userId) return
    // Update game_state.week_number so the game loads that week's wave_config
    await supabase.from('game_state').update({ week_number: weekNum }).eq('user_id', userId)
    setSelectedWeek(weekNum)
    setGoal(weekGoal)
    if (gameState) setGameState({ ...gameState, week_number: weekNum })
  }

  async function getToken(): Promise<string | null> {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ?? null
  }

  async function handleSetup() {
    if (!userId) return
    setSyncing(true)
    setSyncMsg('Setting up your account...')
    const token = await getToken()
    if (!token) { setSyncMsg('Not authenticated'); setSyncing(false); return }

    const res = await fetch('/api/seed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ userId, firstName: 'Player', lastName: 'One' }),
    })
    if (res.ok) {
      setSyncMsg('Running financial analysis (this takes ~30s)...')
      const loop = await fetch('/api/weekly-loop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId }),
      })
      if (loop.ok) {
        setSyncMsg('Done! Reloading...')
        setTimeout(() => window.location.reload(), 3000)
      } else {
        const err = await loop.json()
        setSyncMsg(`Analysis failed: ${err.error}`)
      }
    } else {
      const err = await res.json()
      setSyncMsg(`Setup failed: ${err.error}`)
    }
    setSyncing(false)
  }

  async function handleSync() {
    if (!userId) return
    setSyncing(true)
    setSyncMsg('Syncing financial data...')
    const token = await getToken()
    if (!token) { setSyncMsg('Not authenticated'); setSyncing(false); return }

    const res = await fetch('/api/weekly-loop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ userId }),
    })
    if (res.ok) {
      const data = await res.json()
      if (data.goalAchieved) {
        setSyncMsg(`Goal achieved! +${data.goalPointsDelta} pts +${data.goalHealthDelta} HP. Reloading...`)
      } else if (data.goalHealthDelta < 0) {
        setSyncMsg(`Goal missed. ${data.goalHealthDelta} HP penalty. Reloading...`)
      } else {
        setSyncMsg('Sync complete! Reloading...')
      }
      setTimeout(() => window.location.reload(), 3000)
    } else {
      const err = await res.json()
      setSyncMsg(`Sync failed: ${err.error}`)
    }
    setSyncing(false)
  }

  async function handleDismissGoal() {
    if (!userId || !goal?.goal_category) return
    setDismissing(true)
    const token = await getToken()
    if (!token) { setDismissing(false); return }
    const res = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ userId, category: goal.goal_category, reason: 'User marked as intentional' }),
    })
    if (res.ok) {
      const { goal: newGoal } = await res.json()
      setGoal(newGoal)
    }
    setDismissing(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <p className="text-amber-400 text-xl animate-pulse">Loading...</p>
    </div>
  )

  // For targeted goals, track spend in the specific category; fallback to total
  const categorySpend = (goal?.goal_category && transactions.length > 0)
    ? transactions.filter(t => t.category === goal.goal_category).reduce((s, t) => s + Number(t.amount), 0)
    : goal?.actual_spent ?? 0
  const spentPct   = goal ? Math.min(100, (categorySpend / goal.goal_amount) * 100) : 0
  const overBudget = goal ? categorySpend > goal.goal_amount : false
  const hasSubscriptions = transactions.some(t => t.category === 'subscriptions')
  const hasFlagged     = transactions.some(t => t.flagged)

  // Midweek projection
  const weekStart    = goal?.week_start_date ? new Date(goal.week_start_date) : null
  const daysElapsed  = weekStart ? Math.max(0.5, (Date.now() - weekStart.getTime()) / 86_400_000) : 3.5
  const weekFraction = Math.min(daysElapsed / 7, 1)
  const projectedSpend = (goal && weekFraction > 0.05) ? categorySpend / weekFraction : categorySpend
  const projectedPct   = goal ? Math.min((projectedSpend / goal.goal_amount) * 100, 140) : 0
  const showProjection = weekFraction < 0.95
  const trackingDays   = (weekStart && daysElapsed <= 7) ? Math.max(1, Math.ceil(daysElapsed)) : null
  const trackingSince  = weekStart ? weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : null

  // Which reward tier is the projection currently heading for?
  const projRatio   = goal ? projectedSpend / goal.goal_amount : 1
  const incentiveTier = projRatio <= 0.8 ? 'crush' : projRatio <= 1.0 ? 'hit' : projRatio <= 1.2 ? 'close' : projRatio < 1.5 ? 'miss' : 'bad'

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* NPC Popup */}
      {activeNPC && userId && (
        <NPCPopup npcType={activeNPC} userId={userId} onClose={() => setActiveNPC(null)} />
      )}
      {/* Nav */}
      <nav className="border-b border-gray-800 px-6 py-4 flex justify-between items-center">
        <h1 className="text-xl font-bold text-amber-400">FortifyFi</h1>
        <div className="flex items-center gap-4">
          <span className="text-gray-400 text-sm">{email}</span>
          <button onClick={handleLogout} className="text-sm text-gray-400 hover:text-white transition-colors">
            Logout
          </button>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">

        {/* Setup banner */}
        {needsSetup && (
          <div className="bg-amber-950/50 border border-amber-600 rounded-lg p-5">
            <h2 className="text-amber-400 font-bold text-lg mb-1">Welcome to FortifyFi!</h2>
            <p className="text-gray-300 text-sm mb-4">
              Set up your account to generate spending data and unlock the game.
            </p>
            <button
              onClick={handleSetup}
              disabled={syncing}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-semibold rounded-lg transition-colors"
            >
              {syncing ? syncMsg : 'Set Up Account'}
            </button>
          </div>
        )}

        {/* Sync status */}
        {syncMsg && !needsSetup && (
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm text-gray-300">
            {syncMsg}
          </div>
        )}

        {/* Week selector */}
        {allWeeks.length > 1 && (
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-3">Week History</p>
            <div className="flex gap-2 flex-wrap">
              {[...allWeeks].reverse().map((w, i) => {
                const weekNum = i + 1
                const isSelected = selectedWeek === weekNum
                return (
                  <button
                    key={w.id}
                    onClick={() => handleSelectWeek(weekNum, w)}
                    className={`px-4 py-2 rounded-lg border text-xs font-semibold transition-all ${
                      isSelected
                        ? 'border-amber-500 bg-amber-500/10 text-amber-400'
                        : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-500 hover:text-white'
                    }`}
                  >
                    Week {weekNum}
                  </button>
                )
              })}
            </div>
            {selectedWeek && selectedWeek !== gameState?.week_number && (
              <p className="text-amber-400 text-xs mt-2">⚠ Viewing Week {selectedWeek} — Play This Week will use this wave</p>
            )}
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Points</p>
            <p className="text-3xl font-bold text-amber-400">{gameState?.points ?? 0}</p>
          </div>
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">City HP</p>
            <p className="text-3xl font-bold text-red-400">{gameState?.city_health ?? 100}</p>
          </div>
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Week Score</p>
            {goal?.score != null ? (
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-3xl font-bold text-green-400">{goal.score}</p>
                  <span className={`text-sm font-bold px-2 py-0.5 rounded ${
                    goal.score >= 90 ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500' :
                    goal.score >= 75 ? 'bg-green-500/20 text-green-400 ring-1 ring-green-500' :
                    goal.score >= 60 ? 'bg-blue-500/20 text-blue-400 ring-1 ring-blue-500' :
                    goal.score >= 45 ? 'bg-yellow-500/20 text-yellow-400 ring-1 ring-yellow-500' :
                                       'bg-red-500/20 text-red-400 ring-1 ring-red-500'
                  }`}>
                    {goal.score >= 90 ? 'S' : goal.score >= 75 ? 'A' : goal.score >= 60 ? 'B' : goal.score >= 45 ? 'C' : 'D'}
                  </span>
                </div>
                <p className="text-gray-600 text-xs mt-1">
                  {goal.score >= 80 ? 'Easy wave · bonus tower unlocked' : goal.score >= 50 ? 'Medium wave' : 'Hard wave · city pre-damaged'}
                </p>
              </div>
            ) : <p className="text-3xl font-bold text-green-400">—</p>}
          </div>
        </div>

        {/* NPC Advisors */}
        {!needsSetup && (
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setActiveNPC('warden')}
              className={`relative text-left p-4 rounded-lg border transition-all hover:scale-[1.02] ${
                overBudget
                  ? 'bg-red-950/50 border-red-700 shadow-red-900/30 shadow-lg'
                  : 'bg-gray-900 border-gray-800 hover:border-red-800'
              }`}
            >
              {overBudget && (
                <span className="absolute top-3 right-3 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
              )}
              <p className="text-2xl mb-1">⚔️</p>
              <p className="text-white font-semibold">The Warden</p>
              <p className="text-gray-400 text-xs mt-0.5">Financial Enforcer</p>
              {overBudget && <p className="text-red-400 text-xs mt-2 font-medium">⚠ Over budget — Warden wants a word</p>}
            </button>

            <button
              onClick={() => setActiveNPC('scout')}
              className={`relative text-left p-4 rounded-lg border transition-all hover:scale-[1.02] ${
                hasFlagged
                  ? 'bg-teal-950/50 border-teal-700 shadow-teal-900/30 shadow-lg'
                  : 'bg-gray-900 border-gray-800 hover:border-teal-800'
              }`}
            >
              {hasFlagged && (
                <span className="absolute top-3 right-3 w-2.5 h-2.5 bg-teal-400 rounded-full animate-pulse" />
              )}
              <p className="text-2xl mb-1">🔍</p>
              <p className="text-white font-semibold">The Scout</p>
              <p className="text-gray-400 text-xs mt-0.5">Spending Investigator</p>
              {hasFlagged && <p className="text-teal-400 text-xs mt-2 font-medium">🔍 Suspicious transactions found</p>}
            </button>
          </div>
        )}

        {/* Weekly goal */}
        {goal && (
          <div className="bg-gray-900 rounded-lg p-5 border border-gray-800 space-y-3">

            {/* Header */}
            <div className="flex justify-between items-center">
              <h2 className="text-white font-semibold">This Week's Goal</h2>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${overBudget ? 'bg-red-900/50 text-red-400' : 'bg-green-900/50 text-green-400'}`}>
                {overBudget ? 'Over target' : 'On track'}
              </span>
            </div>

            {/* Label + tracking since */}
            {goal.goal_label && <p className="text-amber-400 text-sm">{goal.goal_label}</p>}
            {trackingSince && (
              <p className="text-gray-600 text-xs">Tracking since {trackingSince} · Day {trackingDays} of 7</p>
            )}

            {/* Progress bar with projected marker */}
            <div>
              <div className="relative w-full bg-gray-800 rounded-full h-3 mb-2">
                <div
                  className={`h-3 rounded-full transition-all ${spentPct > 100 ? 'bg-red-500' : spentPct > 80 ? 'bg-amber-500' : 'bg-green-500'}`}
                  style={{ width: `${Math.min(spentPct, 100)}%` }}
                />
                {showProjection && (
                  <div
                    className={`absolute top-0 h-3 w-0.5 rounded-full ${projectedPct > 100 ? 'bg-red-400' : 'bg-amber-300'} opacity-80`}
                    style={{ left: `${Math.min(projectedPct, 99.5)}%` }}
                    title={`Projected end-of-week: $${projectedSpend.toFixed(0)}`}
                  />
                )}
              </div>
              <div className="flex justify-between text-xs text-gray-400">
                <span>Spent: <span className="text-white">${categorySpend.toFixed(0)}</span></span>
                {showProjection && (
                  <span className={projectedSpend > goal.goal_amount ? 'text-red-400' : 'text-gray-500'}>
                    Projected: ${projectedSpend.toFixed(0)}
                  </span>
                )}
                <span className={overBudget ? 'text-red-400' : 'text-gray-400'}>
                  {overBudget
                    ? `$${(categorySpend - goal.goal_amount).toFixed(0)} over`
                    : `$${(goal.goal_amount - categorySpend).toFixed(0)} left`}
                  {' / $'}{goal.goal_amount.toFixed(0)} target
                </span>
              </div>
            </div>

            {/* Incentive tiers */}
            <div className="bg-gray-800/60 rounded-lg p-3 border border-gray-700/50">
              <p className="text-gray-500 text-xs uppercase tracking-wide mb-2">Goal Rewards</p>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className={`rounded p-2 ${incentiveTier === 'crush' ? 'bg-amber-500/20 border border-amber-500/40' : 'bg-gray-800'}`}>
                  <p className="text-amber-400 font-medium">Crush it</p>
                  <p className="text-gray-500 text-xs">Under 80%</p>
                  <p className="text-gray-300 mt-1">+75 pts · +10 HP</p>
                </div>
                <div className={`rounded p-2 ${incentiveTier === 'hit' ? 'bg-green-500/20 border border-green-500/40' : 'bg-gray-800'}`}>
                  <p className="text-green-400 font-medium">Hit target</p>
                  <p className="text-gray-500 text-xs">Under 100%</p>
                  <p className="text-gray-300 mt-1">+50 pts · +5 HP</p>
                </div>
                <div className={`rounded p-2 ${incentiveTier === 'miss' || incentiveTier === 'bad' ? 'bg-red-500/20 border border-red-500/40' : 'bg-gray-800'}`}>
                  <p className="text-red-400 font-medium">Miss it</p>
                  <p className="text-gray-500 text-xs">Over 120%</p>
                  <p className="text-gray-300 mt-1">−10 to −20 HP</p>
                </div>
              </div>
              {incentiveTier !== 'close' && (
                <p className={`text-xs mt-2 font-medium ${
                  incentiveTier === 'crush' ? 'text-amber-400' :
                  incentiveTier === 'hit'   ? 'text-green-400' : 'text-red-400'
                }`}>
                  {incentiveTier === 'crush' ? '🎯 On track for Crush it — keep going' :
                   incentiveTier === 'hit'   ? '✓ On track to hit target' :
                   incentiveTier === 'bad'   ? '⚠ Significant miss projected — cut back now' :
                                               '⚠ Slight miss projected'}
                </p>
              )}
            </div>

            {/* Dismiss */}
            {goal.goal_category && (
              <div className="pt-1 border-t border-gray-800 flex items-center justify-between">
                <p className="text-gray-500 text-xs">This spend is intentional?</p>
                <button
                  onClick={handleDismissGoal}
                  disabled={dismissing}
                  className="text-xs text-gray-400 hover:text-amber-400 disabled:opacity-40 transition-colors underline underline-offset-2"
                >
                  {dismissing ? 'Recalculating...' : `Skip ${goal.goal_category} → find another goal`}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Spending category breakdown */}
        {transactions.length > 0 && (() => {
          const cats: Record<string, number> = {}
          transactions.forEach(t => { if (t.category) cats[t.category] = (cats[t.category] ?? 0) + Number(t.amount) })
          const sorted = Object.entries(cats).sort(([,a],[,b]) => b - a).slice(0, 5)
          const max = sorted[0]?.[1] ?? 1
          const icons: Record<string, string> = { food:'🍔', subscriptions:'📱', shopping:'🛍️', transport:'🚗', entertainment:'🎬', utilities:'⚡', other:'📦' }
          return (
            <div className="bg-gray-900 rounded-lg p-5 border border-gray-800">
              <h2 className="text-white font-semibold mb-3">Spending Breakdown</h2>
              <div className="space-y-2">
                {sorted.map(([cat, amt]) => (
                  <div key={cat} className="flex items-center gap-3">
                    <span className="text-sm w-4">{icons[cat] ?? '📦'}</span>
                    <span className="text-gray-400 text-xs w-24 capitalize">{cat}</span>
                    <div className="flex-1 bg-gray-800 rounded-full h-2">
                      <div className="h-2 rounded-full bg-amber-500 transition-all" style={{ width: `${(amt / max) * 100}%` }} />
                    </div>
                    <span className="text-gray-300 text-xs w-16 text-right">${amt.toFixed(0)}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })()}

        {/* Play + Sync buttons */}
        <div className="flex gap-4">
          <button
            onClick={() => router.push('/game')}
            disabled={needsSetup}
            className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black font-bold rounded-lg transition-colors text-lg"
          >
            Play This Week
          </button>
          <button
            onClick={handleSync}
            disabled={syncing || needsSetup}
            className="px-5 py-3 border border-gray-700 hover:border-gray-500 disabled:opacity-40 text-gray-300 rounded-lg transition-colors text-sm"
          >
            {syncing ? 'Syncing...' : 'Sync Data'}
          </button>
        </div>

        {/* Transactions */}
        {transactions.length > 0 && (
          <div className="bg-gray-900 rounded-lg border border-gray-800">
            <div className="p-4 border-b border-gray-800">
              <h2 className="text-white font-semibold">Recent Transactions</h2>
            </div>
            <div className="divide-y divide-gray-800">
              {transactions.map(txn => (
                <div key={txn.id} className="px-4 py-3 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    {txn.flagged && (
                      <span className="text-xs bg-red-900/50 text-red-400 border border-red-800 px-2 py-0.5 rounded-full">
                        flagged
                      </span>
                    )}
                    <div>
                      <p className="text-white text-sm">{txn.merchant ?? 'Unknown'}</p>
                      {txn.flag_reason && (
                        <p className="text-red-400 text-xs">{txn.flag_reason}</p>
                      )}
                      {txn.transaction_date && (
                        <p className="text-gray-600 text-xs">{new Date(txn.transaction_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-white text-sm font-medium">${txn.amount.toFixed(2)}</p>
                    <p className="text-gray-500 text-xs">{txn.category}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>
    </div>
  )
}
