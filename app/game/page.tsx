'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { WaveConfig } from '@/lib/types'
import type { GameInitData } from '@/components/game/GameScene'
import NPCPopup from '@/components/npc/NPCPopup'
import type { NPCType } from '@/agents/npc'

const GameCanvas = dynamic(() => import('@/components/game/GameCanvas'), { ssr: false })

const DEFAULT_WAVE: WaveConfig = {
  id: '', user_id: '', week_number: 1, financial_score: 50,
  enemy_count: 14, enemy_speed: 1.2, enemy_hp: 100, spawn_rate: 1.8,
  bonus_tower: null, created_at: '',
}

export default function GamePage() {
  const router = useRouter()
  const [initData, setInitData]   = useState<GameInitData | null>(null)
  const [userId, setUserId]       = useState<string | null>(null)
  const [gsData, setGsData]       = useState<{ best_points_week: number; best_health_week: number; plays_this_week: number } | null>(null)
  const [loading, setLoading]     = useState(true)
  const [result, setResult]       = useState<{ won: boolean; points: number; cityHealth: number } | null>(null)
  const [activeNPC, setActiveNPC] = useState<NPCType | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      const [{ data: gs }, { data: wc }] = await Promise.all([
        supabase.from('game_state')
          .select('points,city_health,week_start_points,week_start_health,week_number,best_points_week,best_health_week,plays_this_week')
          .eq('user_id', user.id).single(),
        supabase.from('wave_config').select('*').eq('user_id', user.id)
          .order('week_number', { ascending: false }).limit(1).single(),
      ])

      const weekNum = gs?.week_number
      const { data: weekWc } = weekNum
        ? await supabase.from('wave_config').select('*').eq('user_id', user.id).eq('week_number', weekNum).single()
        : { data: null }

      setGsData({
        best_points_week:  gs?.best_points_week  ?? 0,
        best_health_week:  gs?.best_health_week  ?? 0,
        plays_this_week:   gs?.plays_this_week   ?? 0,
      })
      setInitData({
        points:     gs?.week_start_points || gs?.points || 0,
        cityHealth: gs?.week_start_health || gs?.city_health || 100,
        waveConfig: weekWc ?? wc ?? DEFAULT_WAVE,
      })
      setLoading(false)
    }
    load()
  }, [])

  async function handleGameOver(res: { won: boolean; points: number; cityHealth: number }) {
    setResult(res)
    if (!userId) return

    const currentBest = gsData?.best_points_week ?? 0
    const isNewBest   = res.points > currentBest

    const update: Record<string, number> = {
      plays_this_week: (gsData?.plays_this_week ?? 0) + 1,
    }
    if (isNewBest) {
      update.best_points_week = res.points
      update.best_health_week = res.cityHealth
      update.points           = res.points
      update.city_health      = res.cityHealth
    }

    await supabase.from('game_state').update(update).eq('user_id', userId)
  }

  function openPostGameNPC(type?: NPCType) {
    if (!result) return
    if (type) { setActiveNPC(type); return }
    // Default: Medic on loss, Architect on win
    setActiveNPC(result.won ? 'architect' : 'medic')
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <p className="text-amber-400 text-xl animate-pulse">Loading fortress...</p>
    </div>
  )

  if (!initData) return null

  return (
    <div className="bg-gray-950 flex flex-col items-center py-6 px-4 pb-12">
      {activeNPC && userId && (
        <NPCPopup npcType={activeNPC} userId={userId} onClose={() => setActiveNPC(null)} gameResult={result ?? undefined} />
      )}
      <div className="w-full max-w-5xl">

        {/* Header */}
        <div className="flex justify-between items-center mb-3">
          <h1 className="text-2xl font-bold text-amber-400">FortiFi</h1>
          <button onClick={() => router.push('/dashboard')} className="text-gray-400 hover:text-white text-sm transition-colors">
            ← Dashboard
          </button>
        </div>

        {/* Result banner */}
        {result && (
          <div className={`mb-3 p-4 rounded-lg text-center border ${result.won ? 'bg-green-950/60 border-green-600' : 'bg-red-950/60 border-red-600'}`}>
            <p className={`text-xl font-bold ${result.won ? 'text-green-400' : 'text-red-400'}`}>
              {result.won ? 'Fortress Held!' : 'Fortress Fell!'}
            </p>
            <p className="text-gray-300 text-sm mt-1">
              Points: {result.points} &nbsp;|&nbsp; City HP: {result.cityHealth}
            </p>
            <div className="flex gap-3 justify-center mt-3 flex-wrap">
              <button onClick={() => openPostGameNPC()}
                className={`px-4 py-2 border font-semibold text-sm rounded transition-colors ${
                  result.won
                    ? 'border-blue-600 hover:border-blue-400 text-blue-400'
                    : 'border-green-600 hover:border-green-400 text-green-400'
                }`}>
                {result.won ? '📐 Talk to Architect' : '🏥 Talk to Medic'}
              </button>
              <button onClick={() => openPostGameNPC('warden')}
                className="px-4 py-2 border border-red-700 hover:border-red-500 text-red-400 rounded font-semibold text-sm transition-colors">
                ⚔️ Talk to Warden
              </button>
              <button onClick={() => router.push('/dashboard')}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black rounded font-semibold text-sm transition-colors">
                Back to Dashboard
              </button>
            </div>
          </div>
        )}

        {/* Game canvas */}
        <div className="rounded-lg overflow-hidden border border-gray-800">
          <GameCanvas initData={initData} onGameOver={handleGameOver} />
        </div>

        {/* Tower legend */}
        <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
          <div className="bg-gray-900 p-3 rounded-lg">
            <p className="text-green-400 font-semibold mb-1">Archer Tower — 50pts</p>
            <p className="text-gray-400">Fast attack · 20 dmg · medium range</p>
          </div>
          <div className="bg-gray-900 p-3 rounded-lg">
            <p className="text-blue-400 font-semibold mb-1">Cannon Tower — 120pts</p>
            <p className="text-gray-400">Slow attack · 60 dmg + splash · short range</p>
          </div>
          <div className="bg-gray-900 p-3 rounded-lg">
            <p className="text-amber-400 font-semibold mb-1">How to play</p>
            <p className="text-gray-400">Select tower · click to place · hover to see range · right-click to sell (½ refund)</p>
          </div>
        </div>

      </div>
    </div>
  )
}
