'use client'
import { useState } from 'react'

type Tab = 'enemies' | 'towers' | 'advisors'

const enemies = [
  {
    emoji: '🍔', name: 'Foodie', hp: 'Low', speed: 'Normal', damage: '15 HP',
    desc: 'Your everyday dining-out habit. Easy to stop, but they arrive in numbers early on.',
  },
  {
    emoji: '🛍️', name: 'Impulse Buyer', hp: 'Very Low', speed: 'Fast', damage: '10 HP',
    desc: 'Fragile but sprints through your defenses. Catch them before they slip past your towers.',
  },
  {
    emoji: '📱', name: 'Subscription Creep', hp: 'High', speed: 'Slow', damage: '25 HP',
    desc: 'Durable and persistent — takes a lot of hits but moves slowly. The cost you forgot to cancel.',
  },
  {
    emoji: '🎬', name: 'Night Owl', hp: 'Normal', speed: 'Brisk', damage: '15 HP',
    desc: 'Late-night spending given form. Slightly quicker than average; shows up in mid-difficulty waves.',
  },
  {
    emoji: '💳', name: 'Debt Collector', hp: 'Very High', speed: 'Moderate', damage: '35 HP',
    desc: 'The boss. Only appears in hard waves. Shrugs off damage and punishes your fortress badly if it breaks through.',
  },
]

const towers = [
  {
    emoji: '🏹',
    name: 'Archer Tower',
    cost: '50 pts',
    color: 'text-green-400',
    border: 'border-green-900',
    bg: 'bg-green-950/20',
    stats: [
      { label: 'Damage', value: '20 per hit' },
      { label: 'Range', value: '2.5 cells' },
      { label: 'Fire Rate', value: 'Fast — 0.9s' },
    ],
    desc: 'Cheap and reliable. Best placed along the early path to shred fast Impulse Buyers before they escape. Your go-to starter.',
    tip: 'Right-click to sell for 25 pts (50% refund)',
  },
  {
    emoji: '💣',
    name: 'Cannon Tower',
    cost: '120 pts',
    color: 'text-blue-400',
    border: 'border-blue-900',
    bg: 'bg-blue-950/20',
    stats: [
      { label: 'Damage', value: '60 + splash' },
      { label: 'Range', value: '2.0 cells' },
      { label: 'Fire Rate', value: 'Slow — 2.4s' },
    ],
    desc: 'Heavy hitter with splash damage that clips nearby enemies on impact. Ideal at chokepoints where Subscription Creeps and Debt Collectors bunch up.',
    tip: 'Barrel rotates to track the nearest enemy',
  },
]

const advisors = [
  {
    emoji: '⚔️', name: 'The Warden', role: 'Financial Enforcer',
    trigger: 'Highlighted when you\'re over budget',
    desc: 'Militaristic and direct. Calls out overspending by category and issues clear orders to cut back. No excuses accepted.',
  },
  {
    emoji: '🔍', name: 'The Scout', role: 'Spending Investigator',
    trigger: 'Highlighted when flagged transactions exist',
    desc: 'Investigates suspicious merchants and forgotten recurring charges. If money is leaking somewhere, the Scout will find it.',
  },
  {
    emoji: '📐', name: 'The Architect', role: 'Savings Strategist',
    trigger: 'Always available',
    desc: 'Long-term thinker. Analyzes your savings rate, income allocation, and financial runway across weeks.',
  },
  {
    emoji: '📦', name: 'The Quartermaster', role: 'Budget Allocator',
    trigger: 'Always available',
    desc: 'Runs a category-by-category audit using the 50/30/20 rule. Tells you exactly where each dollar should be going.',
  },
  {
    emoji: '🏥', name: 'The Medic', role: 'Recovery Specialist',
    trigger: 'Post-game triage only — HP = 0',
    desc: 'Appears only after you lose. Gives 1–2 concrete repair actions to stabilize your finances before the next wave.',
  },
]

export default function LandingGuide() {
  const [tab, setTab] = useState<Tab>('enemies')

  const tabs: [Tab, string][] = [
    ['enemies', '👾 Enemies'],
    ['towers', '🏰 Towers'],
    ['advisors', '🤖 AI Advisors'],
  ]

  return (
    <div id="guide" className="max-w-4xl mx-auto px-6 py-16 border-t border-gray-800">
      <h2 className="text-center text-gray-400 text-xs uppercase tracking-widest mb-2">Field Guide</h2>
      <p className="text-center text-gray-600 text-sm mb-8">Everything you need to know before the wave hits</p>

      <div className="flex justify-center gap-2 mb-8">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === id
                ? 'bg-amber-500 text-black'
                : 'bg-gray-900 text-gray-400 hover:text-gray-200 border border-gray-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'enemies' && (
        <div className="grid gap-3">
          {enemies.map(e => (
            <div key={e.name} className="flex items-start gap-4 bg-gray-900 rounded-xl p-4 border border-gray-800">
              <span className="text-3xl leading-none mt-1">{e.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-1">
                  <span className="text-white font-semibold">{e.name}</span>
                  <span className="text-xs text-gray-500">HP: {e.hp}</span>
                  <span className="text-xs text-gray-500">Speed: {e.speed}</span>
                  <span className="text-xs text-red-400 font-medium">City Damage: {e.damage}</span>
                </div>
                <p className="text-gray-400 text-sm">{e.desc}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'towers' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {towers.map(t => (
            <div key={t.name} className={`rounded-xl p-5 border ${t.border} ${t.bg}`}>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">{t.emoji}</span>
                <div>
                  <h3 className={`font-semibold ${t.color}`}>{t.name}</h3>
                  <span className="text-xs text-gray-500">{t.cost}</span>
                </div>
              </div>
              <div className="flex gap-5 mb-4">
                {t.stats.map(s => (
                  <div key={s.label}>
                    <div className="text-xs text-gray-500 mb-0.5">{s.label}</div>
                    <div className="text-sm text-gray-200 font-medium">{s.value}</div>
                  </div>
                ))}
              </div>
              <p className="text-gray-400 text-sm mb-3">{t.desc}</p>
              <p className="text-xs text-gray-600 italic">{t.tip}</p>
            </div>
          ))}
        </div>
      )}

      {tab === 'advisors' && (
        <div className="grid gap-3">
          {advisors.map(a => (
            <div key={a.name} className="flex items-start gap-4 bg-gray-900 rounded-xl p-4 border border-gray-800">
              <span className="text-3xl leading-none mt-1">{a.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-0.5">
                  <span className="text-white font-semibold">{a.name}</span>
                  <span className="text-xs text-amber-400 font-medium">{a.role}</span>
                </div>
                <p className="text-xs text-gray-600 mb-1">{a.trigger}</p>
                <p className="text-gray-400 text-sm">{a.desc}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
