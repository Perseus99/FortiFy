'use client'

import { useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { ParsedTxn, Period } from '@/lib/types'
import { CAT_ICONS } from '@/lib/constants'

type Step = 'picker' | 'parsing' | 'preview' | 'confirming' | 'done'

const PERIOD_CONFIG: Record<Period, { label: string; badge: string; desc: string; color: string }> = {
  week1:     { label: 'Week 1',       badge: 'W1',  desc: 'Full feature demo — goals, NPCs, game', color: 'border-amber-600 bg-amber-500/10 text-amber-400' },
  week1half: { label: 'Mid-Week',     badge: 'W1½', desc: 'Day 3–4 check-in — goal progress bar',  color: 'border-blue-600 bg-blue-500/10 text-blue-400' },
  week2:     { label: 'Week 2',       badge: 'W2',  desc: 'New week — NPC memory of Week 1',       color: 'border-green-600 bg-green-500/10 text-green-400' },
}


interface Props {
  userId: string
  onClose: () => void
  onComplete: () => void
}

export default function StatementUpload({ userId, onClose, onComplete }: Props) {
  const [step, setStep]               = useState<Step>('picker')
  const [period, setPeriod]           = useState<Period>('week1')
  const [transactions, setTxns]       = useState<ParsedTxn[]>([])
  const [totalSpend, setTotalSpend]   = useState(0)
  const [totalIncome, setTotalIncome] = useState(0)
  const [error, setError]             = useState<string | null>(null)
  const [fileName, setFileName]       = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function getToken() {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ?? null
  }

  async function handleFile(file: File) {
    setFileName(file.name)
    setError(null)
    setStep('parsing')

    const token = await getToken()
    if (!token) { setError('Not authenticated'); setStep('picker'); return }

    const form = new FormData()
    form.append('file', file)
    form.append('period', period)

    try {
      const res = await fetch('/api/upload-statement', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Parse failed'); setStep('picker'); return }

      setTxns(data.transactions)
      setTotalSpend(data.totalSpend)
      setTotalIncome(data.totalIncome)
      setStep('preview')
    } catch (e: any) {
      setError(e.message)
      setStep('picker')
    }
  }

  async function handleConfirm() {
    setError(null)
    setStep('confirming')

    const token = await getToken()
    if (!token) { setError('Not authenticated'); setStep('preview'); return }

    try {
      const res = await fetch('/api/confirm-statement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId, transactions, period }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to apply statement'); setStep('preview'); return }

      setStep('done')
      setTimeout(onComplete, 1200)
    } catch (e: any) {
      setError(e.message)
      setStep('preview')
    }
  }

  const cfg = PERIOD_CONFIG[period]

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-lg bg-gray-900 border border-gray-700 rounded-xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-800 flex justify-between items-center">
          <div>
            <p className="text-white font-bold">Upload Bank Statement</p>
            <p className="text-gray-500 text-xs mt-0.5">PDF → parse → apply to dashboard</p>
          </div>
          {step !== 'confirming' && step !== 'done' && (
            <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none">×</button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* Period selector — always visible in picker step */}
          {(step === 'picker' || step === 'parsing') && (
            <div>
              <p className="text-gray-400 text-xs uppercase tracking-wide mb-2">Demo Period</p>
              <div className="grid grid-cols-3 gap-2">
                {(Object.entries(PERIOD_CONFIG) as [Period, typeof PERIOD_CONFIG[Period]][]).map(([key, c]) => (
                  <button
                    key={key}
                    onClick={() => setPeriod(key)}
                    disabled={step === 'parsing'}
                    className={`p-3 rounded-lg border text-left transition-all disabled:opacity-60 ${
                      period === key ? c.color : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    <p className="font-bold text-sm">{c.label}</p>
                    <p className="text-xs mt-0.5 opacity-70">{c.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* File drop zone */}
          {step === 'picker' && (
            <div>
              <p className="text-gray-400 text-xs uppercase tracking-wide mb-2">Statement File</p>
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-700 hover:border-gray-500 rounded-lg p-8 text-center transition-colors"
              >
                <p className="text-2xl mb-2">📄</p>
                <p className="text-gray-300 text-sm font-medium">Click to upload PDF or TXT</p>
                <p className="text-gray-600 text-xs mt-1">Bank statement — PDF or plain text</p>
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.txt,text/plain"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
              />
              {error && <p className="text-red-400 text-xs mt-2">{error}</p>}

              {/* Sample downloads */}
              <div className="mt-3 p-3 bg-gray-800/60 rounded-lg border border-gray-700/50">
                <p className="text-gray-500 text-xs uppercase tracking-wide mb-2">Demo Samples</p>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { key: 'week1', file: 'week1-statement.txt' },
                    { key: 'week1half', file: 'week1half-statement.txt' },
                    { key: 'week2', file: 'week2-statement.txt' },
                  ].map(({ key, file }) => (
                    <a
                      key={key}
                      href={`/samples/${file}`}
                      download={file}
                      className={`px-2.5 py-1 rounded border text-xs transition-colors ${PERIOD_CONFIG[key as Period].color} hover:opacity-80`}
                      onClick={e => { e.stopPropagation(); setPeriod(key as Period) }}
                    >
                      ↓ {PERIOD_CONFIG[key as Period].label}
                    </a>
                  ))}
                </div>
                <p className="text-gray-600 text-xs mt-1.5">Download a sample, then upload it above</p>
              </div>
            </div>
          )}

          {/* Parsing state */}
          {step === 'parsing' && (
            <div className="text-center py-8">
              <p className="text-2xl animate-pulse mb-3">📄</p>
              <p className="text-gray-300 text-sm font-medium animate-pulse">Parsing statement with Claude...</p>
              <p className="text-gray-600 text-xs mt-1">{fileName}</p>
            </div>
          )}

          {/* Preview */}
          {step === 'preview' && (
            <>
              {/* Summary bar */}
              <div className={`rounded-lg border p-4 ${cfg.color}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-sm">{cfg.label}</p>
                    <p className="text-xs opacity-70 mt-0.5">{cfg.desc}</p>
                  </div>
                  <div className="text-right text-xs">
                    <p>{transactions.length} transactions</p>
                    {totalIncome > 0 && <p className="opacity-70">+${totalIncome.toFixed(0)} income</p>}
                    <p className="opacity-70">${totalSpend.toFixed(0)} spend</p>
                  </div>
                </div>
              </div>

              {error && <p className="text-red-400 text-xs">{error}</p>}

              {/* Transaction list */}
              <div>
                <p className="text-gray-400 text-xs uppercase tracking-wide mb-2">Parsed Transactions</p>
                <div className="bg-gray-800 rounded-lg divide-y divide-gray-700 max-h-60 overflow-y-auto">
                  {transactions.map((t, i) => (
                    <div key={i} className="px-3 py-2 flex justify-between items-center gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm">{CAT_ICONS[t.category] ?? '📦'}</span>
                        <div className="min-w-0">
                          <p className="text-white text-xs truncate">{t.merchant}</p>
                          {t.flagged && t.flag_reason && (
                            <p className="text-red-400 text-xs truncate">{t.flag_reason}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-xs font-medium ${t.category === 'income' ? 'text-green-400' : 'text-white'}`}>
                          {t.category === 'income' ? '+' : ''}${t.amount.toFixed(2)}
                        </p>
                        {t.flagged && <span className="text-red-400 text-xs">⚑</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {period === 'week2' && (
                <div className="bg-green-950/40 border border-green-800 rounded-lg px-3 py-2">
                  <p className="text-green-400 text-xs font-medium">Week 2 mode</p>
                  <p className="text-gray-400 text-xs mt-0.5">A completed Week 1 goal (score 72) will be seeded so NPCs can reference it.</p>
                </div>
              )}
            </>
          )}

          {/* Confirming */}
          {step === 'confirming' && (
            <div className="text-center py-8">
              <p className="text-2xl animate-pulse mb-3">⚙️</p>
              <p className="text-gray-300 text-sm font-medium animate-pulse">Applying statement...</p>
              <p className="text-gray-600 text-xs mt-1">Running financial analysis</p>
            </div>
          )}

          {/* Done */}
          {step === 'done' && (
            <div className="text-center py-8">
              <p className="text-2xl mb-3">✓</p>
              <p className="text-gray-300 text-sm font-medium">Statement applied!</p>
              <p className="text-gray-600 text-xs mt-1">Reloading dashboard...</p>
            </div>
          )}
        </div>

        {/* Footer actions */}
        {step === 'preview' && (
          <div className="px-5 py-4 border-t border-gray-800 flex gap-3">
            <button
              onClick={() => { setStep('picker'); setTxns([]); setError(null) }}
              className="px-4 py-2 border border-gray-700 hover:border-gray-500 text-gray-400 rounded-lg text-sm transition-colors"
            >
              Re-upload
            </button>
            <button
              onClick={handleConfirm}
              className="flex-1 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-lg text-sm transition-colors"
            >
              Apply {cfg.label} Statement
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
