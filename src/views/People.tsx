import { useState, useMemo } from 'react'
import { useVault } from '../store/vault'
import { FBFriend } from '../types'
import { formatDateShort } from '../utils/format'
import SourceBadge from './SourceBadge'

function initials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

function avatarColor(name: string): string {
  const colors = [
    'bg-violet-200 text-violet-700',
    'bg-blue-200 text-blue-700',
    'bg-emerald-200 text-emerald-700',
    'bg-amber-200 text-amber-700',
    'bg-rose-200 text-rose-700',
    'bg-cyan-200 text-cyan-700',
  ]
  let hash = 0
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff
  return colors[Math.abs(hash) % colors.length]
}

function FriendCard({ friend, messageCount }: { friend: FBFriend; messageCount: number }) {
  return (
    <div className="bg-white rounded-xl border border-stone-200 p-4 flex items-center gap-3 hover:shadow-sm transition-shadow">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 ${avatarColor(friend.name)}`}>
        {initials(friend.name)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-stone-900 text-sm truncate">{friend.name}</div>
        <div className="text-xs text-stone-400">
          Friends since {formatDateShort(friend.timestamp)}
          {messageCount > 0 && ` · ${messageCount.toLocaleString()} messages`}
        </div>
      </div>
      <SourceBadge source={friend.source} />
    </div>
  )
}

export default function People() {
  const { state } = useVault()
  if (state.phase !== 'ready') return null
  const { vault } = state

  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<'date' | 'name' | 'messages'>('messages')

  // Build message count map
  const msgCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const thread of vault.allThreads) {
      for (const p of thread.participants) {
        if (p && p !== 'Anthony Barberis') {
          counts[p] = (counts[p] ?? 0) + thread.messages.length
        }
      }
    }
    return counts
  }, [vault.allThreads])

  // Deduplicate friends across exports by name
  const uniqueFriends = useMemo(() => {
    const seen = new Set<string>()
    const out: FBFriend[] = []
    for (const f of vault.allFriends) {
      if (!seen.has(f.name)) {
        seen.add(f.name)
        out.push(f)
      }
    }
    return out
  }, [vault.allFriends])

  const filtered = useMemo(() => {
    let friends = uniqueFriends
    if (query.trim()) {
      const q = query.toLowerCase()
      friends = friends.filter(f => f.name.toLowerCase().includes(q))
    }
    if (sort === 'name') friends = [...friends].sort((a, b) => a.name.localeCompare(b.name))
    if (sort === 'date') friends = [...friends].sort((a, b) => b.timestamp - a.timestamp)
    if (sort === 'messages') {
      friends = [...friends].sort((a, b) => (msgCounts[b.name] ?? 0) - (msgCounts[a.name] ?? 0))
    }
    return friends
  }, [uniqueFriends, query, sort, msgCounts])

  return (
    <div className="h-full flex flex-col">
      <div className="bg-white border-b border-stone-200 px-6 py-3 flex items-center gap-3 flex-wrap">
        <h1 className="font-semibold text-stone-800 text-sm">People</h1>
        <input
          type="search"
          placeholder="Search friends…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="border border-stone-200 rounded-lg px-3 py-1.5 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
        <div className="flex gap-1">
          {([['messages', 'By messages'], ['name', 'A–Z'], ['date', 'By date']] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setSort(val)}
              className={`text-xs px-3 py-1 rounded-full transition-colors ${
                sort === val ? 'bg-blue-500 text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="text-xs text-stone-400 ml-auto">{filtered.length} friends</span>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map(friend => (
            <FriendCard
              key={friend.id}
              friend={friend}
              messageCount={msgCounts[friend.name] ?? 0}
            />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-2 text-center text-stone-400 py-20 text-sm">No friends found.</div>
          )}
        </div>
      </div>
    </div>
  )
}
