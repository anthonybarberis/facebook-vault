import { useState, useMemo, useRef, useEffect } from 'react'
import { useVault } from '../store/vault'
import { FBThread, FBMessage } from '../types'
import PhotoImg from './PhotoImg'
import { formatDateTime, formatDateShort } from '../utils/format'

const ME = 'Anthony Barberis'

function ThreadItem({
  thread,
  selected,
  onClick,
}: {
  thread: FBThread
  selected: boolean
  onClick: () => void
}) {
  const lastMsg = thread.messages[thread.messages.length - 1]
  const others = thread.participants.filter(p => p && p !== ME)
  const displayName = thread.title || others.join(', ') || 'Unknown'

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 border-b border-stone-100 hover:bg-stone-50 transition-colors ${
        selected ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-0.5">
        <span className="font-medium text-sm text-stone-800 truncate">{displayName}</span>
        {lastMsg && (
          <span className="text-xs text-stone-400 flex-shrink-0">
            {formatDateShort(lastMsg.timestampMs / 1000)}
          </span>
        )}
      </div>
      {lastMsg?.content && (
        <div className="text-xs text-stone-400 truncate">
          {lastMsg.senderName === ME ? 'You: ' : ''}{lastMsg.content}
        </div>
      )}
      <div className="flex items-center gap-2 mt-1">
        {thread.isGroupThread && (
          <span className="text-xs bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded">group</span>
        )}
        {thread.category !== 'inbox' && (
          <span className="text-xs bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded">{thread.category}</span>
        )}
        <span className="text-xs text-stone-300">{thread.messages.length} msgs</span>
      </div>
    </button>
  )
}

function MessageBubble({
  msg,
  rootHandle,
}: {
  msg: FBMessage
  rootHandle: FileSystemDirectoryHandle
}) {
  const isMe = msg.senderName === ME || msg.senderName === ''
  const hasContent = msg.content || msg.photos?.length || msg.videos?.length || msg.sticker

  if (!hasContent && msg.type === 'Subscribe') return null

  return (
    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-2 group`}>
      <div className={`max-w-[70%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
        {!isMe && (
          <span className="text-xs text-stone-400 mb-1 ml-1">{msg.senderName || 'Unknown'}</span>
        )}
        {msg.isUnsent ? (
          <div className={`px-3 py-2 rounded-2xl text-sm italic text-stone-400 bg-stone-100 border border-dashed border-stone-300`}>
            [message unsent]
          </div>
        ) : (
          <>
            {msg.content && (
              <div className={`px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words ${
                isMe
                  ? 'bg-blue-500 text-white rounded-br-sm'
                  : 'bg-white border border-stone-200 text-stone-800 rounded-bl-sm'
              }`}>
                {msg.content}
              </div>
            )}
            {msg.photos?.map((p, i) => (
              <div key={i} className="mt-1 rounded-xl overflow-hidden max-w-xs">
                <PhotoImg rootHandle={rootHandle} uri={p.uri} className="max-w-full rounded-xl" />
              </div>
            ))}
            {msg.sticker && (
              <div className="mt-1 w-16 h-16">
                <PhotoImg rootHandle={rootHandle} uri={msg.sticker.uri} className="w-full h-full object-contain" />
              </div>
            )}
          </>
        )}
        {msg.reactions && msg.reactions.length > 0 && (
          <div className="flex gap-0.5 mt-0.5">
            {msg.reactions.map((r, i) => (
              <span key={i} title={r.actor} className="text-sm">{r.reaction}</span>
            ))}
          </div>
        )}
        <span className="text-xs text-stone-300 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {formatDateTime(msg.timestampMs)}
        </span>
      </div>
    </div>
  )
}

function ThreadView({ thread, rootHandle }: { thread: FBThread; rootHandle: FileSystemDirectoryHandle }) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'instant' })
  }, [thread.id])

  const others = thread.participants.filter(p => p && p !== ME)
  const displayName = thread.title || others.join(', ') || 'Unknown'

  // Group messages by date
  const grouped = useMemo(() => {
    const groups: Array<{ date: string; messages: FBMessage[] }> = []
    let currentDate = ''
    for (const msg of thread.messages) {
      const date = formatDateShort(msg.timestampMs / 1000)
      if (date !== currentDate) {
        currentDate = date
        groups.push({ date, messages: [] })
      }
      groups[groups.length - 1].messages.push(msg)
    }
    return groups
  }, [thread.messages])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-stone-200 px-4 py-3 flex-shrink-0">
        <div className="font-semibold text-stone-800 text-sm">{displayName}</div>
        <div className="text-xs text-stone-400">
          {thread.messages.length} messages · {others.length > 0 ? others.join(', ') : 'just you'}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 bg-stone-50">
        {grouped.map(group => (
          <div key={group.date}>
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-stone-200" />
              <span className="text-xs text-stone-400 flex-shrink-0">{group.date}</span>
              <div className="flex-1 h-px bg-stone-200" />
            </div>
            {group.messages.map((msg, i) => (
              <MessageBubble key={i} msg={msg} rootHandle={rootHandle} />
            ))}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}

export default function Messages() {
  const { state } = useVault()
  if (state.phase !== 'ready') return null
  const { vault } = state

  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<FBThread | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  const filtered = useMemo(() => {
    let threads = vault.allThreads
    if (categoryFilter !== 'all') {
      threads = threads.filter(t => t.category === categoryFilter)
    }
    if (query.trim()) {
      const q = query.toLowerCase()
      threads = threads.filter(t =>
        t.title.toLowerCase().includes(q) ||
        t.participants.some(p => p.toLowerCase().includes(q)) ||
        t.messages.some(m => m.content?.toLowerCase().includes(q))
      )
    }
    return threads
  }, [vault.allThreads, query, categoryFilter])

  function rootFor(thread: FBThread) {
    return vault.exports.find(e => e.source === thread.source)?.rootHandle ?? vault.exports[0].rootHandle
  }

  return (
    <div className="h-full flex">
      {/* Thread list */}
      <div className="w-72 flex-shrink-0 bg-white border-r border-stone-200 flex flex-col">
        <div className="p-3 border-b border-stone-100 space-y-2">
          <div className="flex items-center justify-between">
            <h1 className="font-semibold text-stone-800 text-sm">Messages</h1>
            <span className="text-xs text-stone-400">{vault.allThreads.length}</span>
          </div>
          <input
            type="search"
            placeholder="Search conversations…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full border border-stone-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
          <div className="flex gap-1 flex-wrap">
            {(['all', 'inbox', 'archived', 'e2ee', 'filtered'] as const).map(cat => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`text-xs px-2 py-0.5 rounded-full transition-colors ${
                  categoryFilter === cat
                    ? 'bg-blue-500 text-white'
                    : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.map(thread => (
            <ThreadItem
              key={thread.id}
              thread={thread}
              selected={selected?.id === thread.id}
              onClick={() => setSelected(thread)}
            />
          ))}
          {filtered.length === 0 && (
            <div className="p-6 text-center text-stone-400 text-sm">No conversations found.</div>
          )}
        </div>
      </div>

      {/* Thread view */}
      <div className="flex-1 overflow-hidden">
        {selected ? (
          <ThreadView thread={selected} rootHandle={rootFor(selected)} />
        ) : (
          <div className="h-full flex items-center justify-center text-stone-300 text-sm">
            Select a conversation
          </div>
        )}
      </div>
    </div>
  )
}
