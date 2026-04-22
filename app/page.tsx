import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-950 text-white">

      {/* Hero */}
      <div className="flex flex-col items-center justify-center px-4 pt-24 pb-16 text-center">
        <div className="text-6xl mb-6">🏰</div>
        <h1 className="text-6xl font-bold text-amber-400 mb-3 tracking-tight">FortiFi</h1>
        <p className="text-gray-300 text-xl mb-2">Your finances. Your fortress.</p>
        <p className="text-gray-500 text-sm max-w-md mb-10">
          A tower defense game where your weekly spending habits determine how hard the enemy waves hit.
          Save more. Defend better.
        </p>
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
      </div>

      {/* How it works */}
      <div className="max-w-4xl mx-auto px-6 py-12 border-t border-gray-800">
        <h2 className="text-center text-gray-400 text-xs uppercase tracking-widest mb-10">How It Works</h2>
        <div className="grid grid-cols-3 gap-6 text-center">
          <div>
            <div className="text-4xl mb-3">📊</div>
            <h3 className="text-white font-semibold mb-1">Upload Your Statement</h3>
            <p className="text-gray-500 text-sm">Upload a bank statement and Claude analyzes your transactions, scoring your financial discipline from 0–100.</p>
          </div>
          <div>
            <div className="text-4xl mb-3">⚔️</div>
            <h3 className="text-white font-semibold mb-1">Defend Your City</h3>
            <p className="text-gray-500 text-sm">Your score sets the wave difficulty. Good week = easy wave. Bad week = 20 enemies at full speed.</p>
          </div>
          <div>
            <div className="text-4xl mb-3">💬</div>
            <h3 className="text-white font-semibold mb-1">Get Coached</h3>
            <p className="text-gray-500 text-sm">AI advisors call out your spending habits after every battle. No sugar-coating.</p>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="max-w-4xl mx-auto px-6 py-12 border-t border-gray-800">
        <h2 className="text-center text-gray-400 text-xs uppercase tracking-widest mb-10">Features</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
            <p className="text-2xl mb-2">🏹 💣</p>
            <h3 className="text-white font-semibold mb-1">2 Tower Types</h3>
            <p className="text-gray-500 text-sm">Archer Tower for fast consistent hits. Cannon Tower for slow, heavy splash damage.</p>
          </div>
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
            <p className="text-2xl mb-2">💸</p>
            <h3 className="text-white font-semibold mb-1">Spending Enemies</h3>
            <p className="text-gray-500 text-sm">Enemy waves scale with your financial score. Overspend and face a relentless horde.</p>
          </div>
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
            <p className="text-2xl mb-2">⚔️ 🔍 📐</p>
            <h3 className="text-white font-semibold mb-1">5 AI Advisors</h3>
            <p className="text-gray-500 text-sm">The Warden, Scout, Architect, Quartermaster, and Medic — each with their own persona and specialty. They remember your history across weeks.</p>
          </div>
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
            <p className="text-2xl mb-2">📄</p>
            <h3 className="text-white font-semibold mb-1">Statement Upload</h3>
            <p className="text-gray-500 text-sm">Upload a bank statement PDF or use a demo sample. Claude parses it, categorizes every transaction, and sets your wave difficulty.</p>
          </div>
        </div>
      </div>

      {/* Footer CTA */}
      <div className="text-center px-4 py-16 border-t border-gray-800">
        <p className="text-gray-400 mb-6 text-lg">Ready to defend your finances?</p>
        <Link href="/signup"
          className="px-10 py-4 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-lg transition-colors text-lg">
          Build Your Fortress →
        </Link>
        <p className="text-gray-600 text-xs mt-8">Powered by Claude AI · Supabase</p>
      </div>

    </main>
  )
}
