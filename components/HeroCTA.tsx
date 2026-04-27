'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function HeroCTA() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setLoggedIn(!!data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setLoggedIn(!!session)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (loggedIn === null) {
    return <div className="h-14 w-64 rounded-lg bg-gray-800 animate-pulse" />
  }

  if (loggedIn) {
    return (
      <Link href="/dashboard"
        className="px-10 py-3 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-lg transition-colors text-lg">
        Go to Dashboard →
      </Link>
    )
  }

  return (
    <div className="flex gap-4 justify-center">
      <Link href="/signup"
        className="px-8 py-3 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-lg transition-colors text-lg">
        Start Playing
      </Link>
      <Link href="/login"
        className="px-8 py-3 border border-gray-700 hover:border-gray-500 text-gray-300 font-semibold rounded-lg transition-colors text-lg">
        Log In
      </Link>
    </div>
  )
}
