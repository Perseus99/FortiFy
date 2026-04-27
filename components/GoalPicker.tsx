'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { CAT_ICONS } from '@/lib/constants'

interface GoalOption {
  category: string
  current_spend: number
  target_amount: number
  savings: number
}

interface Props {
  userId: string
  weekStartDate: string
  weekNumber: number
  onGoalSet: () => void
}

type Difficulty = 'easy' | 'medium' | 'hard'

const DIFFICULTIES: { key: Difficulty; label: string; desc: string; color: string }[] = [
  { key: 'easy',   label: 'Easy',   desc: 'Small reduction needed',   color: 'border-green-600 bg-green-500/10 text-green-400' },
  { key: 'medium', label: 'Medium', desc: 'Moderate change required',  color: 'border-amber-600 bg-amber-500/10 text-amber-400' },
  { key: 'hard',   label: 'Hard',   desc: 'Significant cutback',       color: 'border-red-600 bg-red-500/10 text-red-400' },
]

export default function GoalPicker({ userId, weekStartDate, weekNumber, onGoalSet }: Props) {
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [options, setOptions]       = useState<GoalOption[]>([])
  const [loading, setLoading]       = useState(false)
  const [selected, setSelected]     = useState<GoalOption | null>(null)
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState<string | null>(null)

  async function getToken() {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ?? null
  }

  const fetchOptions = useCallback(async (diff: Difficulty) => {
    const token = await getToken()
    if (!token) { setError('Not authenticated'); return }
    setLoading(true)
    setSelected(null)
    setError(null)
    try {
      const res = await fetch(`/api/goal-options?userId=${userId}&difficulty=${diff}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to load options')
      setOptions(data.options)
    } catch (e: any) {
      setError(e.message)
    }
    setLoading(false)
  }, [userId])

  useEffect(() => { fetchOptions(difficulty) }, [difficulty, fetchOptions])

  async function handleSetGoal() {
    if (!selected) return
    setSaving(true)
    setError(null)
    const token = await getToken()
    if (!token) { setError('Not authenticated'); setSaving(false); return }
    try {
      const res = await fetch('/api/set-goal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          userId,
          category:     selected.category,
          amount:       selected.target_amount,
          weekStartDate,
          weekNumber,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to set goal')
      onGoalSet()
    } catch (e: any) {
      setError(e.message)
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">

      {/* Difficulty */}
      <div>
        <p className="text-gray-400 text-xs uppercase tracking-wide mb-2">Difficulty</p>
        <div className="grid grid-cols-3 gap-2">
          {DIFFICULTIES.map(d => (
            <button
              key={d.key}
              onClick={() => setDifficulty(d.key)}
              className={`p-3 rounded-lg border text-left transition-all ${
                difficulty === d.key
                  ? d.color
                  : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
              }`}
            >
              <p className="font-bold text-sm">{d.label}</p>
              <p className="text-xs mt-0.5 opacity-70">{d.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Category options */}
      <div>
        <p className="text-gray-400 text-xs uppercase tracking-wide mb-2">Pick a Category</p>
        {loading ? (
          <div className="py-6 text-center">
            <p className="text-gray-500 text-sm animate-pulse">Loading options...</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {options.map(opt => (
              <button
                key={opt.category}
                onClick={() => setSelected(opt)}
                className={`p-3 rounded-lg border text-left transition-all ${
                  selected?.category === opt.category
                    ? 'border-amber-500 bg-amber-500/10'
                    : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base">{CAT_ICONS[opt.category] ?? '📦'}</span>
                  <span className="text-white text-sm font-medium capitalize">{opt.category}</span>
                </div>
                <p className="text-gray-400 text-xs">Current: ${opt.current_spend.toFixed(0)}</p>
                <p className="text-amber-400 text-xs font-medium">Goal: ≤${opt.target_amount.toFixed(0)}</p>
                <p className="text-green-400 text-xs">Save ~${opt.savings.toFixed(0)}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}

      <button
        onClick={handleSetGoal}
        disabled={!selected || saving || loading}
        className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black font-bold rounded-lg transition-colors text-sm"
      >
        {saving ? 'Setting goal...' : selected ? `Set ${selected.category} goal →` : 'Select a category above'}
      </button>
    </div>
  )
}
