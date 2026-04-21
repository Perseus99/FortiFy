'use client'

import { useState, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { NPCType, NPCMessage } from '@/agents/npc'

interface Props {
  npcType: NPCType
  userId: string
  onClose: () => void
  gameResult?: { won: boolean; points: number; cityHealth: number }
  initialMessages?: NPCMessage[]
  onMessagesUpdate?: (msgs: NPCMessage[]) => void
}

const NPC_CONFIG = {
  warden: {
    name: 'The Warden',
    icon: '⚔️',
    color: 'border-red-700',
    headerBg: 'bg-red-950',
    headerText: 'text-red-400',
    bubbleBg: 'bg-red-950/40',
    tagline: 'Financial Enforcer',
  },
  scout: {
    name: 'The Scout',
    icon: '🔍',
    color: 'border-teal-700',
    headerBg: 'bg-teal-950',
    headerText: 'text-teal-400',
    bubbleBg: 'bg-teal-950/40',
    tagline: 'Spending Investigator',
  },
}

export default function NPCPopup({ npcType, userId, onClose, gameResult, initialMessages, onMessagesUpdate }: Props) {
  const config = NPC_CONFIG[npcType]
  const [messages, setMessages]   = useState<NPCMessage[]>(initialMessages ?? [])
  const [input, setInput]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [initialized, setInit]    = useState((initialMessages?.length ?? 0) > 0)
  const bottomRef                 = useRef<HTMLDivElement>(null)

  // Opening message only if no history exists
  useEffect(() => {
    if ((initialMessages?.length ?? 0) === 0) sendMessage(null)
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(userText: string | null) {
    setLoading(true)

    const newMessages: NPCMessage[] = userText
      ? [...messages, { role: 'user', content: userText }]
      : messages

    if (userText) {
      setMessages(newMessages)
      onMessagesUpdate?.(newMessages)
    }

    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) { setLoading(false); return }

    // Opening prompt — include game result if triggered post-game
    let openingPrompt: string
    if (npcType === 'warden') {
      openingPrompt = gameResult
        ? `My fortress just ${gameResult.won ? 'held' : 'fell'}! I ended with ${gameResult.points} points and ${gameResult.cityHealth} city HP. Give me your full assessment.`
        : 'Give me your assessment of my finances this week.'
    } else {
      openingPrompt = gameResult
        ? `My fortress just ${gameResult.won ? 'held' : 'fell'} with ${gameResult.cityHealth} city HP remaining. What did you find in my spending this week?`
        : 'What have you found in my spending this week?'
    }

    const payload = userText === null ? [{ role: 'user' as const, content: openingPrompt }] : newMessages

    const res = await fetch('/api/npc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ userId, npcType, messages: payload }),
    })

    if (res.ok) {
      // Minimum 1.2s typing delay so NPC feels alive
      const [data] = await Promise.all([res.json(), new Promise(r => setTimeout(r, 1200))])
      setMessages(prev => {
        const updated = [...(userText ? prev : []), { role: 'assistant' as const, content: data.reply }]
        onMessagesUpdate?.(updated)
        return updated
      })
    }

    setInit(true)
    setLoading(false)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || loading) return
    const text = input.trim()
    setInput('')
    sendMessage(text)
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-4">
      <div className={`w-full max-w-md bg-gray-900 border-2 ${config.color} rounded-xl flex flex-col max-h-[80vh]`}>

        {/* Header */}
        <div className={`${config.headerBg} px-4 py-3 rounded-t-xl flex justify-between items-center`}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">{config.icon}</span>
            <div>
              <p className={`font-bold ${config.headerText}`}>{config.name}</p>
              <p className="text-gray-500 text-xs">{config.tagline}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none">×</button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px]">
          {!initialized && (
            <div className="flex items-center gap-2 text-gray-500 text-sm">
              <span className="animate-pulse">{config.icon}</span>
              <span>Analyzing your finances...</span>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                msg.role === 'user'
                  ? 'bg-gray-700 text-white'
                  : `${config.bubbleBg} border border-gray-700 text-gray-200`
              }`}>
                {msg.role === 'assistant' && (
                  <span className="text-xs font-semibold block mb-1 opacity-60">{config.name}</span>
                )}
                <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
              </div>
            </div>
          ))}
          {loading && initialized && (
            <div className="flex justify-start">
              <div className={`${config.bubbleBg} border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-400`}>
                <span className="animate-pulse">{config.icon} ...</span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="p-3 border-t border-gray-800 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={`Ask ${config.name}...`}
            disabled={loading || !initialized}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-gray-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading || !input.trim() || !initialized}
            className="px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-white rounded-lg text-sm transition-colors"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  )
}
