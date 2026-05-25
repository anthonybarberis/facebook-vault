import { useState, useMemo } from 'react'
import { useVault } from '../store/vault'
import { formatDate, REACTION_EMOJI } from '../utils/format'
import SourceBadge from './SourceBadge'

const PAGE_SIZE = 50

export default function Activity() {
  const { state } = useVault()
  if (state.phase !== 'ready') return null
  const { vault } = state

  const [tab, setTab] = useState<'comments' | 'reactions' | 'pages'>('comments')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)

  const filteredComments = useMemo(() => {
    let items = vault.allComments
    if (query.trim()) {
      const q = query.toLowerCase()
      items = items.filter(c => c.text.toLowerCase().includes(q) || c.title?.toLowerCase().includes(q))
    }
    return items
  }, [vault.allComments, query])

  const filteredReactions = useMemo(() => {
    let items = vault.allReactions
    if (query.trim()) {
      const q = query.toLowerCase()
      items = items.filter(r => r.reaction.toLowerCase().includes(q) || r.title?.toLowerCase().includes(q))
    }
    return items
  }, [vault.allReactions, query])

  const filteredPages = useMemo(() => {
    let items = vault.allPageLikes
    if (query.trim()) {
      const q = query.toLowerCase()
      items = items.filter(p => p.name.toLowerCase().includes(q))
    }
    return items
  }, [vault.allPageLikes, query])

  // Reaction breakdown
  const reactionBreakdown = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const r of vault.allReactions) {
      counts[r.reaction] = (counts[r.reaction] ?? 0) + 1
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
  }, [vault.allReactions])

  const pagedComments = filteredComments.slice(0, page * PAGE_SIZE)
  const pagedReactions = filteredReactions.slice(0, page * PAGE_SIZE)

  return (
    <div className="h-full flex flex-col">
      <div className="bg-white border-b border-stone-200 px-6 py-3 flex items-center gap-3 flex-wrap">
        <h1 className="font-semibold text-stone-800 text-sm">Activity</h1>
        <div className="flex gap-1">
          {([
            ['comments', `Comments (${vault.allComments.length.toLocaleString()})`],
            ['reactions', `Reactions (${vault.allReactions.length.toLocaleString()})`],
            ['pages', `Pages (${vault.allPageLikes.length.toLocaleString()})`],
          ] as const).map(([t, label]) => (
            <button
              key={t}
              onClick={() => { setTab(t); setPage(1) }}
              className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                tab === t ? 'bg-blue-500 text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          type="search"
          placeholder={`Search ${tab}…`}
          value={query}
          onChange={e => { setQuery(e.target.value); setPage(1) }}
          className="border border-stone-200 rounded-lg px-3 py-1.5 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-blue-300 ml-auto"
        />
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="max-w-2xl mx-auto">
          {/* Reaction summary pills (only on reactions tab) */}
          {tab === 'reactions' && (
            <div className="flex gap-2 flex-wrap mb-4">
              {reactionBreakdown.map(([rxn, count]) => (
                <div key={rxn} className="bg-white border border-stone-200 rounded-full px-3 py-1.5 text-sm flex items-center gap-1.5">
                  <span>{REACTION_EMOJI[rxn] ?? '👍'}</span>
                  <span className="font-medium text-stone-700">{rxn}</span>
                  <span className="text-stone-400">{count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}

          {/* Comments */}
          {tab === 'comments' && (
            <div className="space-y-3">
              {pagedComments.map(comment => (
                <div key={comment.id} className="bg-white rounded-xl border border-stone-200 p-4">
                  {comment.title && (
                    <div className="text-xs text-stone-400 mb-1">{comment.title}</div>
                  )}
                  <p className="text-sm text-stone-800 leading-relaxed">"{comment.text}"</p>
                  <div className="flex items-center gap-2 mt-2">
                    <time className="text-xs text-stone-400 font-mono">{formatDate(comment.timestamp)}</time>
                    <SourceBadge source={comment.source} />
                  </div>
                </div>
              ))}
              {filteredComments.length === 0 && (
                <div className="text-center text-stone-400 py-20 text-sm">No comments found.</div>
              )}
              {pagedComments.length < filteredComments.length && (
                <button
                  onClick={() => setPage(p => p + 1)}
                  className="w-full py-3 text-sm text-stone-500 hover:text-stone-700 border border-stone-200 rounded-xl bg-white hover:bg-stone-50"
                >
                  Load more
                </button>
              )}
            </div>
          )}

          {/* Reactions */}
          {tab === 'reactions' && (
            <div className="space-y-2">
              {pagedReactions.map(rxn => (
                <div key={rxn.id} className="bg-white rounded-xl border border-stone-200 px-4 py-3 flex items-center gap-3">
                  <span className="text-xl flex-shrink-0">{REACTION_EMOJI[rxn.reaction] ?? '👍'}</span>
                  <div className="flex-1 min-w-0">
                    {rxn.title && <div className="text-sm text-stone-700 truncate">{rxn.title}</div>}
                    {rxn.targetName && <div className="text-xs text-stone-400 truncate">{rxn.targetName}</div>}
                  </div>
                  <time className="text-xs text-stone-400 font-mono flex-shrink-0">{formatDate(rxn.timestamp)}</time>
                </div>
              ))}
              {filteredReactions.length === 0 && (
                <div className="text-center text-stone-400 py-20 text-sm">No reactions found.</div>
              )}
              {pagedReactions.length < filteredReactions.length && (
                <button
                  onClick={() => setPage(p => p + 1)}
                  className="w-full py-3 text-sm text-stone-500 border border-stone-200 rounded-xl bg-white hover:bg-stone-50"
                >
                  Load more
                </button>
              )}
            </div>
          )}

          {/* Pages */}
          {tab === 'pages' && (
            <div className="space-y-2">
              {filteredPages.map(page => (
                <div key={page.id} className="bg-white rounded-xl border border-stone-200 px-4 py-3 flex items-center gap-3">
                  <span className="text-xl">👍</span>
                  <span className="flex-1 text-sm font-medium text-stone-800">{page.name}</span>
                  <time className="text-xs text-stone-400 font-mono">{formatDate(page.timestamp)}</time>
                </div>
              ))}
              {filteredPages.length === 0 && (
                <div className="text-center text-stone-400 py-20 text-sm">No pages found.</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
