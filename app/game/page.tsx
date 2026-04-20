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
  const [loading, setLoading]     = useState(true)
  const [result, setResult]       = useState<{ won: boolean; points: number; cityHealth: number } | null>(null)
  const [activeNPC, setActiveNPC] = useState<NPCType | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      const [{ data: gs }, { data: wc }] = await Promise.all([
        supabase.from('game_state').select('points,city_health').eq('user_id', user.id).single(),
        supabase.from('wave_config').select('*').eq('user_id', user.id)
          .order('created_at', { ascending: false }).limit(1).single(),
      ])

      setInitData({
        points:     Math.max(gs?.points ?? 0, 250), // always start with at least 250
        cityHealth: gs?.city_health ?? 100,
        waveConfig: wc ?? DEFAULT_WAVE,
      })
      setLoading(false)
    }
    load()
  }, [])

  async function handleGameOver(res: { won: boolean; points: number; cityHealth: number }) {
    setResult(res)
    if (!userId) return
    await supabase.from('game_state').upsert(
      { user_id: userId, points: res.points, city_health: res.cityHealth },
      { onConflict: 'user_id' }
    )
    // Trigger NPC: Warden on loss or close call, Scout on clean win
    setActiveNPC(!res.won || res.cityHealth < 50 ? 'warden' : 'scout')
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
        <NPCPopup npcType={activeNPC} userId={userId} onClose={() => setActiveNPC(null)} />
      )}
      <div className="w-full max-w-5xl">

        {/* Header */}
        <div className="flex justify-between items-center mb-3">
          <h1 className="text-2xl font-bold text-amber-400">FortifyFi</h1>
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
            <button onClick={() => router.push('/dashboard')}
              className="mt-3 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black rounded font-semibold text-sm transition-colors">
              Back to Dashboard
            </button>
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
            <p className="text-gray-400">Select tower type · click any non-path cell to place · hover tower to see range</p>
          </div>
        </div>

      </div>
    </div>
  )
}
