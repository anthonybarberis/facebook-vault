import { useMemo, useState } from 'react'
import { useVault } from '../store/vault'
import { FBPost } from '../types'
import PhotoImg from './PhotoImg'
import { formatYear } from '../utils/format'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function dayDiffInYear(timestamp: number, today: Date): number {
  const pd = new Date(timestamp * 1000)
  const postThisYear = new Date(today.getFullYear(), pd.getMonth(), pd.getDate())
  let diff = Math.round((postThisYear.getTime() - today.getTime()) / 86400000)
  if (diff > 182) diff -= 365
  if (diff < -182) diff += 365
  return diff
}

function groupByYear(posts: FBPost[]): { year: number; posts: FBPost[] }[] {
  const map = new Map<number, FBPost[]>()
  posts.forEach(p => {
    const y = new Date(p.timestamp * 1000).getFullYear()
    if (!map.has(y)) map.set(y, [])
    map.get(y)!.push(p)
  })
  return Array.from(map.entries())
    .sort(([a], [b]) => a - b)
    .map(([year, posts]) => ({ year, posts }))
}

function relLabel(diff: number, today: Date): string {
  if (diff === -1) return 'Yesterday'
  if (diff === 1) return 'Tomorrow'
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + diff)
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

// ─── Memory Card ─────────────────────────────────────────────────────────────

function MemoryCard({ post, rootHandle }: { post: FBPost; rootHandle?: FileSystemDirectoryHandle }) {
  const [expanded, setExpanded] = useState(false)
  const text = post.text ?? ''
  const isLong = text.length > 300
  const display = isLong && !expanded ? text.slice(0, 300) + '…' : text
  const photos = post.attachments.filter(a => a.type === 'photo' && a.uri)
  const place = post.attachments.find(a => a.type === 'place')

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-sm">
      {/* Meta row */}
      <div className="flex items-center gap-2 mb-2 text-xs text-stone-400">
        {place && <span>📍 {place.placeName}</span>}
      </div>

      {display && (
        <p className="text-stone-800 text-sm leading-relaxed whitespace-pre-wrap">
          {display}
          {isLong && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="ml-1 text-blue-500 hover:text-blue-600 text-xs"
            >
              {expanded ? 'show less' : 'read more'}
            </button>
          )}
        </p>
      )}

      {photos.length > 0 && (
        <div className={`mt-3 grid gap-1 rounded-lg overflow-hidden ${
          photos.length === 1 ? 'grid-cols-1' : photos.length === 2 ? 'grid-cols-2' : 'grid-cols-3'
        }`}>
          {photos.slice(0, 6).map((att, i) => (
            <PhotoImg
              key={i}
              rootHandle={rootHandle}
              uri={att.uri!}
              alt={att.mediaTitle ?? ''}
              className={`w-full object-cover ${photos.length === 1 ? 'max-h-72' : 'h-32'}`}
            />
          ))}
        </div>
      )}

      {!display && !photos.length && post.title && (
        <p className="text-sm text-stone-400 italic">{post.title}</p>
      )}
    </div>
  )
}

// ─── Year Group ───────────────────────────────────────────────────────────────

function YearGroup({ year, posts, rootFor }: {
  year: number
  posts: FBPost[]
  rootFor: (p: FBPost) => FileSystemDirectoryHandle | undefined
}) {
  const [collapsed, setCollapsed] = useState(false)
  const yearsAgo = new Date().getFullYear() - year
  const label = yearsAgo === 0 ? 'This year' : yearsAgo === 1 ? '1 year ago' : `${yearsAgo} years ago`

  return (
    <div>
      <button
        onClick={() => setCollapsed(c => !c)}
        className="flex items-center gap-3 w-full text-left mb-3 group"
      >
        <div className="text-lg font-bold text-stone-700">{year}</div>
        <div className="text-xs text-stone-400">{label} · {posts.length} {posts.length === 1 ? 'post' : 'posts'}</div>
        <div className="ml-auto text-stone-300 group-hover:text-stone-500 text-sm">{collapsed ? '▸' : '▾'}</div>
      </button>
      {!collapsed && (
        <div className="space-y-3 ml-1 pl-4 border-l-2 border-stone-100">
          {posts.map(p => (
            <MemoryCard key={p.id} post={p} rootHandle={rootFor(p)} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main View ────────────────────────────────────────────────────────────────

export default function Memories() {
  const { state } = useVault()
  if (state.phase !== 'ready') return null
  const { vault } = state

  const today = useMemo(() => new Date(), [])

  function rootFor(post: FBPost) {
    return vault.exports.find(e => e.source === post.source)?.rootHandle
  }

  const { onThisDay, weekGroups } = useMemo(() => {
    const onThisDay: FBPost[] = []
    const byDiff = new Map<number, FBPost[]>()

    vault.allPosts.forEach(p => {
      const diff = dayDiffInYear(p.timestamp, today)
      if (diff === 0) {
        onThisDay.push(p)
      } else if (Math.abs(diff) <= 3) {
        if (!byDiff.has(diff)) byDiff.set(diff, [])
        byDiff.get(diff)!.push(p)
      }
    })

    onThisDay.sort((a, b) => a.timestamp - b.timestamp)

    // Sort week days: -3 -2 -1 +1 +2 +3
    const weekGroups = Array.from(byDiff.entries())
      .sort(([a], [b]) => a - b)
      .map(([diff, posts]) => ({
        diff,
        label: relLabel(diff, today),
        byYear: groupByYear(posts.sort((a, b) => a.timestamp - b.timestamp)),
      }))

    return { onThisDay, weekGroups }
  }, [vault.allPosts, today])

  const onThisDayByYear = groupByYear(onThisDay)

  const todayLabel = today.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  })

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-6">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">✨</span>
            <h1 className="text-xl font-bold text-stone-800">Memories</h1>
          </div>
          <p className="text-sm text-stone-400 ml-9">{todayLabel}</p>
        </div>

        {/* On This Day */}
        <section className="mb-10">
          <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-5">
            On This Day
            {onThisDay.length > 0 && <span className="ml-2 font-normal normal-case tracking-normal">· {onThisDay.length} {onThisDay.length === 1 ? 'memory' : 'memories'}</span>}
          </h2>
          {onThisDay.length === 0 ? (
            <p className="text-stone-400 text-sm">Nothing from this day in previous years.</p>
          ) : (
            <div className="space-y-6">
              {onThisDayByYear.map(({ year, posts }) => (
                <YearGroup key={year} year={year} posts={posts} rootFor={rootFor} />
              ))}
            </div>
          )}
        </section>

        {/* This Week */}
        <section>
          <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-5">
            This Week
            {weekGroups.length > 0 && (
              <span className="ml-2 font-normal normal-case tracking-normal">
                · {weekGroups.reduce((s, g) => s + g.byYear.reduce((s2, y) => s2 + y.posts.length, 0), 0)} memories
              </span>
            )}
          </h2>
          {weekGroups.length === 0 ? (
            <p className="text-stone-400 text-sm">Nothing from this week in previous years.</p>
          ) : (
            <div className="space-y-10">
              {weekGroups.map(({ diff, label, byYear }) => (
                <div key={diff}>
                  <div className="flex items-center gap-3 mb-4">
                    <h3 className="text-sm font-semibold text-stone-600">{label}</h3>
                    <div className="flex-1 h-px bg-stone-200" />
                    <span className="text-xs text-stone-400">
                      {byYear.reduce((s, y) => s + y.posts.length, 0)} posts
                    </span>
                  </div>
                  <div className="space-y-6">
                    {byYear.map(({ year, posts }) => (
                      <YearGroup key={year} year={year} posts={posts} rootFor={rootFor} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  )
}
