import LandingNav from '@/components/LandingNav'
import HeroCTA from '@/components/HeroCTA'
import LandingGuide from '@/components/LandingGuide'

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <LandingNav />

      {/* Hero */}
      <div className="flex flex-col items-center justify-center px-4 pt-36 pb-16 text-center">
        <div className="text-7xl mb-6" style={{ filter: 'drop-shadow(0 0 28px rgba(245,158,11,0.55))' }}>
          🏰
        </div>
        <h1 className="text-6xl font-bold mb-3 tracking-tight bg-gradient-to-r from-amber-400 to-yellow-300 bg-clip-text text-transparent">
          FortiFi
        </h1>
        <p className="text-gray-200 text-xl mb-2 font-medium">Your finances. Your fortress.</p>
        <p className="text-gray-500 text-sm max-w-md mb-7">
          A tower defense game where your weekly spending habits determine how hard the enemy waves hit.
          Save more. Defend better.
        </p>

        {/* Score badge mock */}
        <div className="flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-full px-5 py-2 text-sm mb-10 flex-wrap justify-center">
          <span className="text-gray-500">📊 Score</span>
          <span className="font-mono font-bold text-green-400">78</span>
          <span className="text-gray-700">→</span>
          <span className="text-green-400 font-semibold">Easy Wave</span>
          <span className="text-gray-700 mx-1">·</span>
          <span className="text-gray-500">Score</span>
          <span className="font-mono font-bold text-red-400">34</span>
          <span className="text-gray-700">→</span>
          <span className="text-red-400 font-semibold">Brutal Wave</span>
        </div>

        <HeroCTA />
      </div>

      {/* How It Works */}
      <div id="how-it-works" className="max-w-4xl mx-auto px-6 py-12 border-t border-gray-800">
        <h2 className="text-center text-gray-400 text-xs uppercase tracking-widest mb-10">How It Works</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
          <div>
            <div className="text-4xl mb-3">📊</div>
            <h3 className="text-white font-semibold mb-2">Upload Your Statement</h3>
            <p className="text-gray-500 text-sm">Upload a bank statement and Claude analyzes your transactions, scoring your financial discipline from 0–100.</p>
          </div>
          <div>
            <div className="text-4xl mb-3">⚔️</div>
            <h3 className="text-white font-semibold mb-2">Defend Your City</h3>
            <p className="text-gray-500 text-sm">Your score sets the wave difficulty. Good week = easy wave. Bad week = 20 enemies at full speed.</p>
          </div>
          <div>
            <div className="text-4xl mb-3">💬</div>
            <h3 className="text-white font-semibold mb-2">Get Coached</h3>
            <p className="text-gray-500 text-sm">5 AI advisors call out your spending habits after every battle. They remember your history across weeks.</p>
          </div>
        </div>
      </div>

      {/* Score → Wave Difficulty */}
      <div className="max-w-4xl mx-auto px-6 py-12 border-t border-gray-800">
        <h2 className="text-center text-gray-400 text-xs uppercase tracking-widest mb-2">Score → Wave Difficulty</h2>
        <p className="text-center text-gray-600 text-sm mb-10">Your financial score directly controls what attacks your fortress</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

          <div className="bg-gray-900 rounded-xl p-5 border border-green-900 text-center">
            <div className="text-3xl mb-3">🟢</div>
            <div className="text-green-400 font-bold text-lg mb-1">Score 75+</div>
            <div className="text-gray-500 text-sm mb-4">Good Week</div>
            <div className="text-xs text-gray-500 space-y-1.5">
              <div>≤ 8 enemies</div>
              <div>Foodies + Subscription Creeps</div>
              <div>Slow spawn rate</div>
            </div>
            <div className="mt-4 text-green-500 text-xs font-semibold tracking-wide">Easy — breathe</div>
          </div>

          <div className="bg-gray-900 rounded-xl p-5 border border-amber-900 text-center">
            <div className="text-3xl mb-3">🟡</div>
            <div className="text-amber-400 font-bold text-lg mb-1">Score 45–74</div>
            <div className="text-gray-500 text-sm mb-4">Average Week</div>
            <div className="text-xs text-gray-500 space-y-1.5">
              <div>9–14 enemies</div>
              <div>+ Impulse Buyers + Night Owls</div>
              <div>Faster spawns</div>
            </div>
            <div className="mt-4 text-amber-400 text-xs font-semibold tracking-wide">Medium — stay sharp</div>
          </div>

          <div className="bg-gray-900 rounded-xl p-5 border border-red-900 text-center">
            <div className="text-3xl mb-3">🔴</div>
            <div className="text-red-400 font-bold text-lg mb-1">Score &lt; 45</div>
            <div className="text-gray-500 text-sm mb-4">Rough Week</div>
            <div className="text-xs text-gray-500 space-y-1.5">
              <div>15+ enemies</div>
              <div>+ Debt Collectors</div>
              <div>Rapid spawns</div>
            </div>
            <div className="mt-4 text-red-400 text-xs font-semibold tracking-wide">Hard — brace for impact</div>
          </div>

        </div>
      </div>

      {/* Guide */}
      <LandingGuide />

      {/* CTA */}
      <div className="text-center px-4 py-16 border-t border-gray-800">
        <p className="text-gray-400 mb-6 text-lg">Ready to defend your finances?</p>
        <HeroCTA />
      </div>
    </main>
  )
}
