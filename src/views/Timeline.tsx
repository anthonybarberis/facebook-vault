import { useState, useMemo, useEffect, useCallback } from 'react'
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

function PostCard({ post, rootHandle }: { post: FBPost; rootHandle: FileSystemDirectoryHandle }) {
  const [expanded, setExpanded] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const text = post.text ?? ''
  const isLong = text.length > 400
  const displayText = isLong && !expanded ? text.slice(0, 400) + '…' : text

  const photos = post.attachments.filter(a => a.type === 'photo' || a.type === 'video')
  const links = post.attachments.filter(a => a.type === 'link')
  const infos = post.attachments.filter(a => a.type === 'info')

  return (
    <article className="bg-white rounded-xl border border-stone-200 p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <time className="text-xs text-stone-400 font-mono">{formatDate(post.timestamp)}</time>
        <SourceBadge source={post.source} />
      </div>

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

export default function Timeline() {
  const { state } = useVault()
  if (state.phase !== 'ready') return null
  const { vault } = state

  const [query, setQuery] = useState('')
  const [yearFilter, setYearFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [page, setPage] = useState(1)

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

  const paged = filtered.slice(0, page * PAGE_SIZE)
  const hasMore = paged.length < filtered.length

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
          onChange={e => { setQuery(e.target.value); setPage(1) }}
          className="border border-stone-200 rounded-lg px-3 py-1.5 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
        <select
          value={yearFilter}
          onChange={e => { setYearFilter(e.target.value); setPage(1) }}
          className="border border-stone-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none"
        >
          <option value="all">All years</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select
          value={typeFilter}
          onChange={e => { setTypeFilter(e.target.value); setPage(1) }}
          className="border border-stone-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none"
        >
          <option value="all">All types</option>
          <option value="text">Text only</option>
          <option value="photo">With photos</option>
          <option value="link">With links</option>
        </select>
        <span className="text-xs text-stone-400 ml-auto">{filtered.length.toLocaleString()} posts</span>
      </div>

      {/* Posts */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-2xl mx-auto space-y-4">
          {paged.map(post => (
            <PostCard key={post.id} post={post} rootHandle={rootFor(post)} />
          ))}

          {filtered.length === 0 && (
            <div className="text-center text-stone-400 py-20 text-sm">No posts match your filters.</div>
          )}

          {hasMore && (
            <button
              onClick={() => setPage(p => p + 1)}
              className="w-full py-3 text-sm text-stone-500 hover:text-stone-700 border border-stone-200 rounded-xl bg-white hover:bg-stone-50 transition-colors"
            >
              Load more ({(filtered.length - paged.length).toLocaleString()} remaining)
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
