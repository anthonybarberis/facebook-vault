import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useVault } from '../store/vault'
import { FBPost } from '../types'
import PhotoImg from './PhotoImg'
import PostLightbox from './PostLightbox'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MONTH_STARTS = [1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335]
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAYS = 365

function getDOY(date: Date): number {
  // Day of year 1–365
  return Math.ceil((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000)
}

function doyToDate(doy: number): Date {
  const d = new Date(new Date().getFullYear(), 0, doy)
  return d
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

// ─── Scrubber ─────────────────────────────────────────────────────────────────

function DayScrubber({ date, onChange }: { date: Date; onChange: (d: Date) => void }) {
  const trackRef  = useRef<HTMLDivElement>(null)
  const dragging  = useRef(false)
  const dateRef   = useRef(date)
  const changeRef = useRef(onChange)
  useEffect(() => { dateRef.current   = date },     [date])
  useEffect(() => { changeRef.current = onChange }, [onChange])

  const doy      = getDOY(date)
  const fraction = (doy - 1) / (DAYS - 1)

  const applyX = useCallback((clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect) return
    const f      = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    const newDoy = Math.round(f * (DAYS - 1)) + 1
    changeRef.current(doyToDate(newDoy))
  }, [])

  useEffect(() => {
    const onMove  = (e: MouseEvent)  => { if (dragging.current) applyX(e.clientX) }
    const onTouch = (e: TouchEvent)  => { if (dragging.current) applyX(e.touches[0].clientX) }
    const onUp    = ()               => { dragging.current = false }
    window.addEventListener('mousemove',  onMove)
    window.addEventListener('mouseup',    onUp)
    window.addEventListener('touchmove',  onTouch)
    window.addEventListener('touchend',   onUp)
    return () => {
      window.removeEventListener('mousemove',  onMove)
      window.removeEventListener('mouseup',    onUp)
      window.removeEventListener('touchmove',  onTouch)
      window.removeEventListener('touchend',   onUp)
    }
  }, [applyX])

  return (
    <div className="select-none px-1">
      {/* Track */}
      <div
        ref={trackRef}
        className="relative h-2 rounded-full bg-stone-200 cursor-pointer"
        onMouseDown={e => { dragging.current = true; applyX(e.clientX) }}
        onTouchStart={e => { dragging.current = true; applyX(e.touches[0].clientX) }}
      >
        {/* Filled */}
        <div
          className="absolute inset-y-0 left-0 bg-blue-300 rounded-full pointer-events-none"
          style={{ width: `${fraction * 100}%` }}
        />

        {/* Month tick marks */}
        {MONTH_STARTS.map((start, i) => (
          <div
            key={i}
            className="absolute top-0 bottom-0 w-px bg-stone-300/60 pointer-events-none"
            style={{ left: `${((start - 1) / (DAYS - 1)) * 100}%` }}
          />
        ))}

        {/* Thumb */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-blue-500 ring-2 ring-white shadow-md pointer-events-none"
          style={{ left: `${fraction * 100}%` }}
        />
      </div>

      {/* Month labels */}
      <div className="relative mt-2 h-4">
        {MONTH_STARTS.map((start, i) => (
          <span
            key={i}
            className="absolute -translate-x-1/2 text-[10px] text-stone-400 leading-none"
            style={{ left: `${((start - 1) / (DAYS - 1)) * 100}%` }}
          >
            {MONTH_LABELS[i]}
          </span>
        ))}
      </div>
    </div>
  )
}

// ─── Memory Card ─────────────────────────────────────────────────────────────

function MemoryCard({ post, rootHandle }: { post: FBPost; rootHandle?: FileSystemDirectoryHandle }) {
  const [expanded, setExpanded] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const text    = post.text ?? ''
  const isLong  = text.length > 300
  const display = isLong && !expanded ? text.slice(0, 300) + '…' : text
  const photos  = post.attachments.filter(a => a.type === 'photo' && a.uri)
  const place   = post.attachments.find(a => a.type === 'place')

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-sm">
      {place && (
        <div className="flex items-center gap-1.5 mb-2 text-xs text-stone-400">
          <span>📍</span><span>{place.placeName}</span>
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
    const m   = selectedDate.getMonth()
    const day = selectedDate.getDate()
    return vault.allPosts
      .filter(p => {
        const d = new Date(p.timestamp * 1000)
        return d.getMonth() === m && d.getDate() === day
      })
      .sort((a, b) => a.timestamp - b.timestamp)
  }, [vault.allPosts, selectedDate])

  const byYear    = groupByYear(matchingPosts)
  const dateLabel = selectedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <span className="text-2xl">✨</span>
            <h1 className="text-xl font-bold text-stone-800">Memories</h1>
          </div>
          {!isToday && (
            <button
              onClick={() => setSelectedDate(new Date())}
              className="text-xs text-blue-500 hover:text-blue-600 border border-blue-200 hover:border-blue-400 rounded-full px-3 py-1.5 transition-colors"
            >
              Today
            </button>
          )}
        </div>

        {/* Date display + fine navigation */}
        <div className="flex items-center justify-center gap-4 mb-4">
          <button
            onClick={() => navigate(-1)}
            className="w-8 h-8 flex items-center justify-center rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors text-xl leading-none"
            aria-label="Previous day"
          >‹</button>

          <div className="text-center min-w-[11rem]">
            <div className="text-2xl font-bold text-stone-800">{dateLabel}</div>
            <div className="text-xs text-stone-400 mt-0.5">
              {matchingPosts.length === 0
                ? 'No memories'
                : `${matchingPosts.length} ${matchingPosts.length === 1 ? 'memory' : 'memories'} · ${byYear.length} ${byYear.length === 1 ? 'year' : 'years'}`}
            </div>
          </div>

          <button
            onClick={() => navigate(1)}
            className="w-8 h-8 flex items-center justify-center rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors text-xl leading-none"
            aria-label="Next day"
          >›</button>
        </div>

        {/* Scrubber */}
        <div className="mb-10">
          <DayScrubber date={selectedDate} onChange={setSelectedDate} />
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
