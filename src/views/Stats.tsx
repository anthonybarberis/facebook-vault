import { useMemo } from 'react'
import { useVault } from '../store/vault'
import { formatYear, formatMonth, REACTION_EMOJI } from '../utils/format'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899']

const STOP_WORDS = new Set([
  'the','and','a','an','is','it','in','on','of','to','for','that','this','was',
  'with','are','you','he','she','we','they','at','be','as','not','but','or',
  'have','had','has','his','her','my','your','our','i','me','him','us','so',
  'all','if','would','from','just','by','about','what','when','who','how',
  'get','do','did','been','no','up','out','can','its','than','more','also',
  'like','some','will','one','time','there','their','them','were','which',
  'into','could','then','about','after','back','im','dont','its','am',
])

function wordFrequency(texts: string[], topN = 40): Array<{ word: string; count: number }> {
  const counts: Record<string, number> = {}
  for (const text of texts) {
    const words = text.toLowerCase().match(/\b[a-z']{3,}\b/g) ?? []
    for (const w of words) {
      if (!STOP_WORDS.has(w)) {
        counts[w] = (counts[w] ?? 0) + 1
      }
    }
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([word, count]) => ({ word, count }))
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-stone-200 p-5">
      <div className="text-2xl font-bold text-stone-900">{typeof value === 'number' ? value.toLocaleString() : value}</div>
      <div className="text-sm font-medium text-stone-600 mt-0.5">{label}</div>
      {sub && <div className="text-xs text-stone-400 mt-0.5">{sub}</div>}
    </div>
  )
}

export default function Stats() {
  const { state } = useVault()
  if (state.phase !== 'ready') return null
  const { vault } = state

  // Posts per year
  const postsByYear = useMemo(() => {
    const counts: Record<number, { year: number; export2022: number; export2026: number }> = {}
    for (const post of vault.allPosts) {
      const y = formatYear(post.timestamp)
      if (!counts[y]) counts[y] = { year: y, export2022: 0, export2026: 0 }
      counts[y][post.source]++
    }
    return Object.values(counts).sort((a, b) => a.year - b.year)
  }, [vault.allPosts])

  // Reactions breakdown
  const reactionData = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const r of vault.allReactions) {
      counts[r.reaction] = (counts[r.reaction] ?? 0) + 1
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name: `${REACTION_EMOJI[name] ?? ''} ${name}`, value }))
  }, [vault.allReactions])

  // Top friends by message count
  const topFriends = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const thread of vault.allThreads) {
      for (const p of thread.participants) {
        if (p && p !== 'Anthony Barberis') {
          counts[p] = (counts[p] ?? 0) + thread.messages.length
        }
      }
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name: name.split(' ')[0], count }))
  }, [vault.allThreads])

  // Word frequency in posts
  const topWords = useMemo(() => {
    const texts = vault.allPosts.flatMap(p => p.text ? [p.text] : [])
    return wordFrequency(texts, 40)
  }, [vault.allPosts])

  // Most active month
  const mostActiveMonth = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const p of vault.allPosts) {
      const m = formatMonth(p.timestamp)
      counts[m] = (counts[m] ?? 0) + 1
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
  }, [vault.allPosts])

  // Total messages
  const totalMessages = vault.allThreads.reduce((s, t) => s + t.messages.length, 0)
  const totalPhotos = vault.allAlbums.reduce((s, a) => s + a.photos.length, 0)

  // Date range
  const postTs = vault.allPosts.map(p => p.timestamp).filter(Boolean)
  const earliest = postTs.length > 0 ? new Date(Math.min(...postTs) * 1000).getFullYear() : '?'
  const latest = postTs.length > 0 ? new Date(Math.max(...postTs) * 1000).getFullYear() : '?'

  return (
    <div className="h-full overflow-y-auto px-6 py-6">
      <div className="max-w-5xl mx-auto">
        <h1 className="font-bold text-stone-900 text-xl mb-6">Your Stats</h1>

        {/* Overview cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
          <StatCard label="Posts" value={vault.allPosts.length} sub={`${earliest}–${latest}`} />
          <StatCard label="Comments" value={vault.allComments.length} />
          <StatCard label="Reactions" value={vault.allReactions.length} />
          <StatCard label="Messages" value={totalMessages} sub={`${vault.allThreads.length} threads`} />
          <StatCard label="Photos" value={totalPhotos} sub={`${vault.allAlbums.length} albums`} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Posts by year */}
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <h2 className="font-semibold text-stone-800 mb-4 text-sm">Posts by year</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={postsByYear} barSize={12}>
                <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="export2022" name="2022 export" fill="#8b5cf6" stackId="a" />
                <Bar dataKey="export2026" name="2026 export" fill="#10b981" stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Reactions breakdown */}
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <h2 className="font-semibold text-stone-800 mb-4 text-sm">Reactions breakdown</h2>
            {reactionData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={reactionData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {reactionData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-stone-300 text-sm">No reaction data</div>
            )}
          </div>
        </div>

        {/* Top friends by message count */}
        {topFriends.length > 0 && (
          <div className="bg-white rounded-xl border border-stone-200 p-5 mb-6">
            <h2 className="font-semibold text-stone-800 mb-4 text-sm">Most messaged (by thread message count)</h2>
            <div className="space-y-2">
              {topFriends.map(({ name, count }, i) => (
                <div key={name} className="flex items-center gap-3">
                  <span className="text-xs text-stone-400 w-4 text-right">{i + 1}</span>
                  <span className="text-sm text-stone-700 w-28 truncate">{name}</span>
                  <div className="flex-1 bg-stone-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-blue-400 h-full rounded-full"
                      style={{ width: `${(count / topFriends[0].count) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-stone-500 w-12 text-right">{count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Word cloud (sorted by frequency) */}
        {topWords.length > 0 && (
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <h2 className="font-semibold text-stone-800 mb-4 text-sm">Most used words in your posts</h2>
            <div className="flex flex-wrap gap-2">
              {topWords.map(({ word, count }) => {
                const maxCount = topWords[0].count
                const size = 0.7 + (count / maxCount) * 1.1
                return (
                  <span
                    key={word}
                    title={`${count} times`}
                    className="text-stone-700 font-medium"
                    style={{ fontSize: `${size}rem`, opacity: 0.5 + (count / maxCount) * 0.5 }}
                  >
                    {word}
                  </span>
                )
              })}
            </div>
          </div>
        )}

        {/* Most active month callout */}
        {mostActiveMonth && (
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
            📅 Your most active month was <strong>{mostActiveMonth[0]}</strong> with {mostActiveMonth[1]} posts.
          </div>
        )}
      </div>
    </div>
  )
}
