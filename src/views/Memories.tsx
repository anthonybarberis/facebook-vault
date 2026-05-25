import { useMemo, useState } from 'react'
import { useVault } from '../store/vault'
import { FBPost } from '../types'
import PhotoImg from './PhotoImg'
import PostLightbox from './PostLightbox'

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

// ─── Memory Card ─────────────────────────────────────────────────────────────

function MemoryCard({ post, rootHandle }: { post: FBPost; rootHandle?: FileSystemDirectoryHandle }) {
  const [expanded, setExpanded] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const text = post.text ?? ''
  const isLong = text.length > 300
  const display = isLong && !expanded ? text.slice(0, 300) + '…' : text
  const photos = post.attachments.filter(a => a.type === 'photo' && a.uri)
  const place = post.attachments.find(a => a.type === 'place')

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-sm">
      {place && (
        <div className="flex items-center gap-1.5 mb-2 text-xs text-stone-400">
          <span>📍</span>
          <span>{place.placeName}</span>
        </div>
      )}

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
            <button
              key={i}
              onClick={() => setLightboxIndex(i)}
              className={`block w-full focus:outline-none group relative overflow-hidden ${
                photos.length === 1 ? 'max-h-72' : 'h-32'
              }`}
            >
              <PhotoImg
                rootHandle={rootHandle}
                uri={att.uri!}
                alt={att.mediaTitle ?? ''}
                className="w-full h-full object-cover group-hover:brightness-90 transition-[filter]"
              />
              {i === 5 && photos.length > 6 && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-lg font-semibold">
                  +{photos.length - 6} more
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {!display && !photos.length && post.title && (
        <p className="text-sm text-stone-400 italic">{post.title}</p>
      )}

      {lightboxIndex !== null && (
        <PostLightbox
          photos={photos}
          index={lightboxIndex}
          rootHandle={rootHandle}
          onClose={() => setLightboxIndex(null)}
          onChange={setLightboxIndex}
        />
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
  const [selectedDate, setSelectedDate] = useState(() => new Date())

  if (state.phase !== 'ready') return null
  const { vault } = state

  function rootFor(post: FBPost) {
    return vault.exports.find(e => e.source === post.source)?.rootHandle
  }

  function navigate(delta: number) {
    setSelectedDate(d => {
      const next = new Date(d)
      next.setDate(next.getDate() + delta)
      return next
    })
  }

  const today = useMemo(() => new Date(), [])
  const isToday =
    selectedDate.getMonth() === today.getMonth() &&
    selectedDate.getDate()  === today.getDate()

  const matchingPosts = useMemo(() => {
    const m = selectedDate.getMonth()
    const day = selectedDate.getDate()
    return vault.allPosts
      .filter(p => {
        const d = new Date(p.timestamp * 1000)
        return d.getMonth() === m && d.getDate() === day
      })
      .sort((a, b) => a.timestamp - b.timestamp)
  }, [vault.allPosts, selectedDate])

  const byYear = groupByYear(matchingPosts)

  const dateLabel = selectedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-6">

        {/* Header */}
        <div className="flex items-center gap-2 mb-8">
          <span className="text-2xl">✨</span>
          <h1 className="text-xl font-bold text-stone-800">Memories</h1>
        </div>

        {/* Date navigator */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 flex items-center justify-center rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors text-lg"
            aria-label="Previous day"
          >
            ‹
          </button>

          <div className="text-center min-w-[10rem]">
            <div className="text-2xl font-bold text-stone-800">{dateLabel}</div>
            <div className="text-xs text-stone-400 mt-0.5">
              {matchingPosts.length === 0
                ? 'No memories'
                : `${matchingPosts.length} ${matchingPosts.length === 1 ? 'memory' : 'memories'} · ${byYear.length} ${byYear.length === 1 ? 'year' : 'years'}`}
            </div>
          </div>

          <button
            onClick={() => navigate(1)}
            className="w-9 h-9 flex items-center justify-center rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors text-lg"
            aria-label="Next day"
          >
            ›
          </button>

          {!isToday && (
            <button
              onClick={() => setSelectedDate(new Date())}
              className="ml-2 text-xs text-blue-500 hover:text-blue-600 border border-blue-200 hover:border-blue-400 rounded-full px-3 py-1 transition-colors"
            >
              Today
            </button>
          )}
        </div>

        {/* Memories */}
        {matchingPosts.length === 0 ? (
          <p className="text-stone-400 text-sm text-center py-12">No memories for this day.</p>
        ) : (
          <div className="space-y-6">
            {byYear.map(({ year, posts }) => (
              <YearGroup key={year} year={year} posts={posts} rootFor={rootFor} />
            ))}
          </div>
        )}

      </div>
    </div>
  )
}
