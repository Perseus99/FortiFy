'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function LandingNav() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setLoggedIn(!!data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setLoggedIn(!!session)
    })
    return () => subscription.unsubscribe()
  }, [])

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-950/90 backdrop-blur-sm border-b border-gray-800">
      <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-amber-400 text-lg tracking-tight">
          <span>🏰</span>
          <span>FortiFi</span>
        </Link>

        <div className="flex items-center gap-6">
          <a href="#how-it-works" className="text-gray-400 hover:text-gray-200 text-sm transition-colors hidden sm:block">
            How It Works
          </a>
          <a href="#guide" className="text-gray-400 hover:text-gray-200 text-sm transition-colors hidden sm:block">
            Guide
          </a>

          {loggedIn === null ? (
            <div className="w-28 h-8 rounded-lg bg-gray-800 animate-pulse" />
          ) : loggedIn ? (
            <Link href="/dashboard"
              className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-lg text-sm transition-colors">
              Go to Dashboard
            </Link>
          ) : (
            <div className="flex items-center gap-3">
              <Link href="/login" className="text-gray-300 hover:text-white text-sm transition-colors">
                Log In
              </Link>
              <Link href="/signup"
                className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-lg text-sm transition-colors">
                Start Playing
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
