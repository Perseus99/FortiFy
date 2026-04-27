interface WeekPoint {
  week_number: number
  financial_score: number
  created_at: string
}

interface Props {
  history: WeekPoint[]
}

function scoreColor(s: number) {
  if (s >= 75) return '#22c55e'
  if (s >= 45) return '#f59e0b'
  return '#ef4444'
}

function scoreGrade(s: number) {
  if (s >= 90) return 'S'
  if (s >= 75) return 'A'
  if (s >= 60) return 'B'
  if (s >= 45) return 'C'
  return 'D'
}

function scoreDifficulty(s: number) {
  if (s >= 75) return 'Easy'
  if (s >= 45) return 'Medium'
  return 'Hard'
}

const VB_W = 600
const VB_H = 160
const PAD_L = 36
const PAD_R = 24
const PAD_T = 28
const PAD_B = 28
const CHART_W = VB_W - PAD_L - PAD_R
const CHART_H = VB_H - PAD_T - PAD_B

function toX(i: number, n: number) {
  if (n === 1) return PAD_L + CHART_W / 2
  return PAD_L + (i / (n - 1)) * CHART_W
}

function toY(score: number) {
  return PAD_T + CHART_H - (score / 100) * CHART_H
}

export default function ScoreTimeline({ history }: Props) {
  if (history.length === 0) return null

  const n = history.length
  const points = history.map((w, i) => ({ ...w, x: toX(i, n), y: toY(w.financial_score) }))

  // SVG polyline points string
  const linePts = points.map(p => `${p.x},${p.y}`).join(' ')

  // Threshold Y positions
  const y75 = toY(75)
  const y45 = toY(45)

  return (
    <div className="bg-gray-900 rounded-lg p-5 border border-gray-800">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-white font-semibold">Score History</h2>
        <div className="flex items-center gap-3 text-xs text-gray-600">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />Easy (75+)</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />Medium (45–74)</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />Hard (&lt;45)</span>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className="w-full"
        style={{ height: 160 }}
        aria-label="Week-over-week financial score"
      >
        {/* Threshold bands */}
        <rect x={PAD_L} y={PAD_T} width={CHART_W} height={y75 - PAD_T}
          fill="#22c55e" fillOpacity={0.04} />
        <rect x={PAD_L} y={y75} width={CHART_W} height={y45 - y75}
          fill="#f59e0b" fillOpacity={0.05} />
        <rect x={PAD_L} y={y45} width={CHART_W} height={PAD_T + CHART_H - y45}
          fill="#ef4444" fillOpacity={0.05} />

        {/* Threshold lines */}
        <line x1={PAD_L} y1={y75} x2={PAD_L + CHART_W} y2={y75}
          stroke="#22c55e" strokeOpacity={0.25} strokeDasharray="4 3" strokeWidth={1} />
        <line x1={PAD_L} y1={y45} x2={PAD_L + CHART_W} y2={y45}
          stroke="#ef4444" strokeOpacity={0.25} strokeDasharray="4 3" strokeWidth={1} />

        {/* Threshold labels */}
        <text x={PAD_L - 4} y={y75 + 4} textAnchor="end" fontSize={9} fill="#22c55e" fillOpacity={0.6}>75</text>
        <text x={PAD_L - 4} y={y45 + 4} textAnchor="end" fontSize={9} fill="#ef4444" fillOpacity={0.6}>45</text>

        {/* Line */}
        {n > 1 && (
          <polyline
            points={linePts}
            fill="none"
            stroke="#6b7280"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Points */}
        {points.map((p, i) => {
          const color = scoreColor(p.financial_score)
          const grade = scoreGrade(p.financial_score)
          const diff  = scoreDifficulty(p.financial_score)
          const isLast = i === n - 1

          return (
            <g key={p.week_number}>
              {/* Outer ring on latest point */}
              {isLast && (
                <circle cx={p.x} cy={p.y} r={11} fill={color} fillOpacity={0.15} />
              )}

              {/* Dot */}
              <circle cx={p.x} cy={p.y} r={7} fill={color} />
              <circle cx={p.x} cy={p.y} r={3} fill="white" fillOpacity={0.9} />

              {/* Score label above dot */}
              <text x={p.x} y={p.y - 13} textAnchor="middle" fontSize={10}
                fontWeight="bold" fill={color}>
                {p.financial_score}
              </text>

              {/* Grade badge */}
              <text x={p.x + 10} y={p.y - 9} textAnchor="middle" fontSize={8}
                fill={color} fillOpacity={0.8}>
                {grade}
              </text>

              {/* X-axis label */}
              <text x={p.x} y={VB_H - 4} textAnchor="middle" fontSize={9} fill="#6b7280">
                W{p.week_number}
              </text>

              {/* Difficulty label below x-axis label (last point only, to avoid clutter) */}
              {isLast && (
                <text x={p.x} y={VB_H - 14} textAnchor="middle" fontSize={8} fill={color} fillOpacity={0.7}>
                  {diff}
                </text>
              )}
            </g>
          )
        })}
      </svg>

      {n === 1 && (
        <p className="text-gray-600 text-xs text-center mt-1">Upload more weeks to see your trend</p>
      )}
    </div>
  )
}
