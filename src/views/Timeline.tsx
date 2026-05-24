import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useVault } from '../store/vault'
import { FBPost, FBPostAttachment } from '../types'
import PhotoImg from './PhotoImg'
import { formatDate, formatYear } from '../utils/format'

const PAGE_SIZE = 40

function SourceBadge({ source }: { source: string }) {
  return (
    <span className={`inline-block text-xs px-1.5 py-0.5 rounded font-mono ${
      source === 'export2022'
        ? 'bg-violet-100 text-violet-600'
        : 'bg-emerald-100 text-emerald-600'
    }`}>
      {source === 'export2022' ? '\'22' : '\'26'}
    </span>
  )
}

function LinkPreview({ att }: { att: FBPostAttachment }) {
  if (!att.url) return null
  let domain = ''
  try { domain = new URL(att.url).hostname.replace(/^www\./, '') } catch { /* ignore */ }
  return (
    <a
      href={att.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block border border-stone-200 rounded-lg p-3 hover:bg-stone-50 transition-colors mt-2"
    >
      <div className="text-xs text-stone-400 mb-0.5">{domain}</div>
      {att.linkTitle && <div className="text-sm font-medium text-stone-800 line-clamp-2">{att.linkTitle}</div>}
      {att.linkDescription && <div className="text-xs text-stone-500 mt-0.5 line-clamp-2">{att.linkDescription}</div>}
      {!att.linkTitle && <div className="text-sm text-blue-500 truncate">{att.url}</div>}
    </a>
  )
}

function PostLightbox({
  photos,
  index,
  rootHandle,
  onClose,
  onChange,
}: {
  photos: FBPostAttachment[]
  index: number
  rootHandle?: FileSystemDirectoryHandle
  onClose: () => void
  onChange: (i: number) => void
}) {
  const photo = photos[index]
  const total = photos.length

  const prev = useCallback(() => onChange((index - 1 + total) % total), [index, total, onChange])
  const next = useCallback(() => onChange((index + 1) % total), [index, total, onChange])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, prev, next])

  if (!photo?.uri) return null

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center" onClick={onClose}>
      {/* Prev */}
      {total > 1 && (
        <button
          onClick={e => { e.stopPropagation(); prev() }}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white text-4xl p-2 z-10"
        >‹</button>
      )}

      {/* Image */}
      <div className="max-w-5xl max-h-screen w-full flex flex-col items-center" onClick={e => e.stopPropagation()}>
        <PhotoImg
          rootHandle={rootHandle}
          uri={photo.uri}
          alt={photo.mediaTitle ?? photo.description ?? ''}
          className="max-h-[80vh] max-w-full object-contain rounded-lg"
        />
        {/* Caption / counter */}
        <div className="mt-4 text-center text-white/80 max-w-lg px-4">
          {(photo.description || photo.mediaTitle) && (
            <p className="text-sm mb-2">{photo.description ?? photo.mediaTitle}</p>
          )}
          {total > 1 && (
            <p className="text-xs text-white/40">{index + 1} / {total}</p>
          )}
        </div>
      </div>

      {/* Next */}
      {total > 1 && (
        <button
          onClick={e => { e.stopPropagation(); next() }}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white text-4xl p-2 z-10"
        >›</button>
      )}

      {/* Close */}
      <button onClick={onClose} className="absolute top-4 right-4 text-white/70 hover:text-white text-2xl">✕</button>

      {/* Thumbnail strip */}
      {total > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 max-w-lg overflow-x-auto px-2">
          {photos.map((p, i) => p.uri && (
            <button
              key={i}
              onClick={e => { e.stopPropagation(); onChange(i) }}
              className={`flex-shrink-0 w-12 h-12 rounded overflow-hidden border-2 transition-colors ${
                i === index ? 'border-white' : 'border-transparent opacity-50 hover:opacity-80'
              }`}
            >
              <PhotoImg
                rootHandle={rootHandle}
                uri={p.uri}
                alt=""
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Extract feeling / activity / location / with-people chips from the title. */
function extractMeta(title?: string, tags?: string[]): Array<{ icon: string; label: string }> {
  const chips: Array<{ icon: string; label: string }> = []
  if (!title) return chips

  // Feeling: "is feeling happy [with ...]"
  const feel = title.match(/\bis feeling (\w+)/)
  if (feel) chips.push({ icon: '💭', label: feel[1] })

  // Activity: "was watching/playing/eating/listening to THING"
  const actMap: Record<string, string> = { watching: '🎬', playing: '🎮', eating: '🍽️', 'listening to': '🎵' }
  const act = title.match(/\bwas (watching|playing|eating|listening to) (.+?)(?=\s+with\b|\s+at\b|\.$|$)/)
  if (act) chips.push({ icon: actMap[act[1]] ?? '▶️', label: `${act[1]} ${act[2].trim()}` })

  // Title-based location fallback: only when no place attachment exists
  // (real place data comes from parseAttachments; this catches "was at X" in title only)
  if (!/\b(posted in|wrote on|added .+ to)\b/.test(title)) {
    const loc = title.match(/\bwas (?:with .+? )?at ([A-Z][^.]+?)\.?$/)
    if (loc) chips.push({ icon: '📍', label: loc[1].trim() })
  }

  // "Was with people" — only for standalone "was with" (not inside an activity sentence)
  if (!act) {
    const withMatch = title.match(/\bwas with (.+?)(?:\s+at .+)?\.?$/)
    if (withMatch && !/\b(posted in|wrote on)\b/.test(title)) {
      chips.push({ icon: '🤝', label: `with ${withMatch[1].trim()}` })
    }
  }

  // Tagged people (2026 export `tags` field — people tagged in photo posts)
  if (tags?.length) {
    const names = tags.slice(0, 3).join(', ') + (tags.length > 3 ? ` +${tags.length - 3}` : '')
    chips.push({ icon: '🏷️', label: names })
  }

  return chips
}

/** Extract a human-readable destination from Facebook's auto-generated post title. */
function parseDestination(title: string | undefined): { icon: string; label: string } | null {
  if (!title) return null
  // "… wrote on [Name]'s timeline/profile."
  const wroteOn = title.match(/wrote on (.+?)'s (?:timeline|profile)/)
  if (wroteOn) return { icon: '👤', label: `${wroteOn[1]}'s wall` }
  // "… posted in [Group Name]."
  const postedIn = title.match(/posted in (.+?)\.$/)
  if (postedIn) return { icon: '👥', label: postedIn[1] }
  // "… added … to [Name]'s timeline."
  const addedTo = title.match(/added .+ to (.+?)'s timeline/)
  if (addedTo) return { icon: '👤', label: `${addedTo[1]}'s timeline` }
  return null
}

function PostCard({ post, rootHandle }: { post: FBPost; rootHandle: FileSystemDirectoryHandle }) {
  const [expanded, setExpanded] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const text = post.text ?? ''
  const isLong = text.length > 400
  const displayText = isLong && !expanded ? text.slice(0, 400) + '…' : text

  const photos = post.attachments.filter(a => a.type === 'photo' || a.type === 'video')
  const links = post.attachments.filter(a => a.type === 'link')
  const infos = post.attachments.filter(a => a.type === 'info')
  const places = post.attachments.filter(a => a.type === 'place')
  const destination = parseDestination(post.title)
  const metaChips = [
    ...extractMeta(post.title, post.tags),
    ...places.map(p => ({ icon: '📍', label: p.placeName ?? '' })).filter(c => c.label),
    ...post.attachments.filter(a => a.type === 'life_event' && a.lifeEventTitle)
      .map(a => ({ icon: '🌟', label: a.lifeEventTitle! })),
    ...post.attachments.filter(a => a.type === 'event' && a.eventName)
      .map(a => ({ icon: '📅', label: a.eventName! })),
    ...post.attachments.filter(a => a.type === 'poll' && a.pollQuestion)
      .map(a => ({ icon: '📊', label: a.pollQuestion!.length > 60 ? a.pollQuestion!.slice(0, 60) + '…' : a.pollQuestion! })),
  ]

  return (
    <article className="bg-white rounded-xl border border-stone-200 p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <time className="text-xs text-stone-400 font-mono">{formatDate(post.timestamp)}</time>
        <SourceBadge source={post.source} />
      </div>

      {destination && (
        <div className="flex items-center gap-1.5 text-xs text-stone-400 mb-2 -mt-1">
          <span>{destination.icon}</span>
          <span className="truncate">{destination.label}</span>
        </div>
      )}

      {metaChips.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {metaChips.map((chip, i) => (
            <span key={i} className="inline-flex items-center gap-1 text-xs bg-stone-50 border border-stone-200 text-stone-500 rounded-full px-2 py-0.5">
              <span>{chip.icon}</span>
              <span>{chip.label}</span>
            </span>
          ))}
        </div>
      )}

      {displayText && (
        <div className="text-stone-800 text-sm leading-relaxed whitespace-pre-wrap mb-2">
          {displayText}
          {isLong && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="ml-1 text-blue-500 hover:text-blue-600 text-xs"
            >
              {expanded ? 'show less' : 'read more'}
            </button>
          )}
        </div>
      )}

      {links.map((att, i) => <LinkPreview key={i} att={att} />)}

      {infos.map((att, i) => (
        <div key={i} className="border border-stone-200 rounded-lg p-3 mt-2 text-sm text-stone-500 italic">
          {att.lines?.join(' · ')}
        </div>
      ))}

      {photos.length > 0 && (
        <div className={`mt-3 grid gap-1 rounded-lg overflow-hidden ${
          photos.length === 1 ? 'grid-cols-1' :
          photos.length === 2 ? 'grid-cols-2' :
          photos.length <= 4 ? 'grid-cols-2' :
          'grid-cols-3'
        }`}>
          {photos.slice(0, 6).map((att, i) => (
            att.uri ? (
              <button
                key={i}
                onClick={() => setLightboxIndex(i)}
                className={`block w-full focus:outline-none group relative overflow-hidden ${
                  photos.length === 1 ? 'max-h-96' : 'h-40'
                }`}
              >
                <PhotoImg
                  rootHandle={rootHandle}
                  uri={att.uri}
                  alt={att.mediaTitle ?? ''}
                  className={`w-full h-full object-cover group-hover:brightness-90 transition-[filter]`}
                />
                {/* Overlay for +N tile */}
                {i === 5 && photos.length > 6 && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-lg font-semibold">
                    +{photos.length - 6} more
                  </div>
                )}
              </button>
            ) : null
          ))}
        </div>
      )}

      {!displayText && !photos.length && !links.length && post.title && (
        <div className="text-sm text-stone-400 italic">{post.title}</div>
      )}

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <PostLightbox
          photos={photos}
          index={lightboxIndex}
          rootHandle={rootHandle}
          onClose={() => setLightboxIndex(null)}
          onChange={setLightboxIndex}
        />
      )}
    </article>
  )
}

function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null

  // Build windowed page list: always show first, last, and up to 3 around current
  const pages: (number | '…')[] = []
  if (totalPages <= 9) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  } else {
    pages.push(1)
    if (page > 3) pages.push('…')
    for (let i = Math.max(2, page - 2); i <= Math.min(totalPages - 1, page + 2); i++) pages.push(i)
    if (page < totalPages - 3) pages.push('…')
    pages.push(totalPages)
  }

  const navBtn = (label: string, target: number, disabled: boolean) => (
    <button
      key={label}
      onClick={() => !disabled && onChange(target)}
      disabled={disabled}
      className="w-8 h-8 flex items-center justify-center rounded text-sm text-stone-500 hover:bg-stone-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
    >
      {label}
    </button>
  )

  return (
    <div className="flex items-center justify-center gap-0.5 py-4 flex-wrap">
      {navBtn('«', 1, page === 1)}
      {navBtn('‹', page - 1, page === 1)}
      {pages.map((p, i) =>
        p === '…' ? (
          <span key={`ellipsis-${i}`} className="w-8 h-8 flex items-center justify-center text-stone-400 text-sm select-none">…</span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p as number)}
            className={`w-8 h-8 flex items-center justify-center rounded text-sm transition-colors ${
              p === page
                ? 'bg-blue-600 text-white font-semibold'
                : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            {p}
          </button>
        )
      )}
      {navBtn('›', page + 1, page === totalPages)}
      {navBtn('»', totalPages, page === totalPages)}
    </div>
  )
}

export default function Timeline() {
  const { state } = useVault()
  if (state.phase !== 'ready') return null
  const { vault } = state

  const [query, setQuery] = useState('')
  const [yearFilter, setYearFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [page, setPage] = useState(1)
  const scrollRef = useRef<HTMLDivElement>(null)

  function goToPage(p: number) {
    setPage(p)
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const years = useMemo(() => {
    const ys = new Set(vault.allPosts.map(p => formatYear(p.timestamp)))
    return Array.from(ys).sort((a, b) => b - a)
  }, [vault.allPosts])

  const filtered = useMemo(() => {
    let posts = vault.allPosts
    if (yearFilter !== 'all') {
      const y = parseInt(yearFilter)
      posts = posts.filter(p => formatYear(p.timestamp) === y)
    }
    if (typeFilter === 'text') posts = posts.filter(p => p.text && p.attachments.every(a => a.type !== 'photo'))
    if (typeFilter === 'photo') posts = posts.filter(p => p.attachments.some(a => a.type === 'photo'))
    if (typeFilter === 'link') posts = posts.filter(p => p.attachments.some(a => a.type === 'link'))
    if (query.trim()) {
      const q = query.toLowerCase()
      posts = posts.filter(p =>
        p.text?.toLowerCase().includes(q) ||
        p.title?.toLowerCase().includes(q) ||
        p.attachments.some(a => a.linkTitle?.toLowerCase().includes(q) || a.url?.toLowerCase().includes(q))
      )
    }
    return posts
  }, [vault.allPosts, yearFilter, typeFilter, query])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  // Get the right root handle for a post
  function rootFor(post: FBPost): FileSystemDirectoryHandle {
    return vault.exports.find(e => e.source === post.source)?.rootHandle ?? vault.exports[0].rootHandle
  }

  return (
    <div className="h-full flex flex-col">
      {/* Filter bar */}
      <div className="bg-white border-b border-stone-200 px-6 py-3 flex items-center gap-3 flex-wrap">
        <h1 className="font-semibold text-stone-800 text-sm mr-2">Timeline</h1>
        <input
          type="search"
          placeholder="Search posts…"
          value={query}
          onChange={e => { setQuery(e.target.value); goToPage(1) }}
          className="border border-stone-200 rounded-lg px-3 py-1.5 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
        <select
          value={yearFilter}
          onChange={e => { setYearFilter(e.target.value); goToPage(1) }}
          className="border border-stone-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none"
        >
          <option value="all">All years</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select
          value={typeFilter}
          onChange={e => { setTypeFilter(e.target.value); goToPage(1) }}
          className="border border-stone-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none"
        >
          <option value="all">All types</option>
          <option value="text">Text only</option>
          <option value="photo">With photos</option>
          <option value="link">With links</option>
        </select>
        <span className="text-xs text-stone-400 ml-auto">
          {filtered.length.toLocaleString()} posts · p.{safePage}/{totalPages}
        </span>
      </div>

      {/* Posts */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-2xl mx-auto space-y-4">
          {paged.map(post => (
            <PostCard key={post.id} post={post} rootHandle={rootFor(post)} />
          ))}

          {filtered.length === 0 && (
            <div className="text-center text-stone-400 py-20 text-sm">No posts match your filters.</div>
          )}

          <Pagination page={safePage} totalPages={totalPages} onChange={goToPage} />
        </div>
      </div>
    </div>
  )
}
