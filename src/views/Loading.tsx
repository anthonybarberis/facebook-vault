import { ParseProgress } from '../types'

export default function Loading({ progress }: { progress: ParseProgress }) {
  const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : null

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center px-6">
      <div className="max-w-sm w-full text-center">
        <div className="text-5xl mb-6 animate-pulse">📦</div>
        <h2 className="text-xl font-semibold text-stone-800 mb-2">Loading your archive…</h2>
        <p className="text-stone-500 text-sm mb-8 min-h-[40px]">{progress.stage}</p>

        <div className="w-full bg-stone-200 rounded-full h-1.5 mb-2">
          <div
            className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
            style={{ width: pct !== null ? `${pct}%` : '30%' }}
          />
        </div>
        {pct !== null && (
          <div className="text-xs text-stone-400">{pct}%</div>
        )}
      </div>
    </div>
  )
}
