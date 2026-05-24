import { useState, useMemo } from 'react'
import { useVault } from '../store/vault'
import { FBEvent } from '../types'
import { formatDate } from '../utils/format'

function EventCard({ event }: { event: FBEvent }) {
  const [expanded, setExpanded] = useState(false)
  const hasLongDesc = (event.description?.length ?? 0) > 300

  return (
    <article className="bg-white rounded-xl border border-stone-200 p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <h3 className="font-semibold text-stone-900">{event.name}</h3>
          <div className="text-sm text-stone-500 mt-0.5">
            {formatDate(event.startTimestamp)}
            {event.endTimestamp ? ` – ${formatDate(event.endTimestamp)}` : ''}
          </div>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full flex-shrink-0 ${
          event.role === 'hosted' || event.role === 'created'
            ? 'bg-blue-100 text-blue-700'
            : event.role === 'responded'
            ? 'bg-green-100 text-green-700'
            : 'bg-stone-100 text-stone-500'
        }`}>
          {event.role}
        </span>
      </div>

      {event.place && (
        <div className="text-sm text-stone-500 mb-2 flex items-center gap-1">
          <span>📍</span>
          <span>{event.place.name}{event.place.address ? ` · ${event.place.address}` : ''}</span>
        </div>
      )}

      {event.description && (
        <div className="text-sm text-stone-700 leading-relaxed whitespace-pre-wrap">
          {hasLongDesc && !expanded
            ? event.description.slice(0, 300) + '…'
            : event.description}
          {hasLongDesc && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="ml-1 text-blue-500 hover:text-blue-600 text-xs"
            >
              {expanded ? 'less' : 'more'}
            </button>
          )}
        </div>
      )}

      {event.rsvp && (
        <div className="mt-2 text-xs text-stone-400">RSVP: {event.rsvp}</div>
      )}
    </article>
  )
}

export default function Events() {
  const { state } = useVault()
  if (state.phase !== 'ready') return null
  const { vault } = state

  const [roleFilter, setRoleFilter] = useState('all')
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    let events = vault.allEvents
    if (roleFilter !== 'all') events = events.filter(e => e.role === roleFilter)
    if (query.trim()) {
      const q = query.toLowerCase()
      events = events.filter(e =>
        e.name.toLowerCase().includes(q) ||
        e.description?.toLowerCase().includes(q) ||
        e.place?.name.toLowerCase().includes(q)
      )
    }
    return events
  }, [vault.allEvents, roleFilter, query])

  const roles = ['all', 'hosted', 'created', 'responded', 'invited']

  return (
    <div className="h-full flex flex-col">
      <div className="bg-white border-b border-stone-200 px-6 py-3 flex items-center gap-3 flex-wrap">
        <h1 className="font-semibold text-stone-800 text-sm">Events</h1>
        <input
          type="search"
          placeholder="Search events…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="border border-stone-200 rounded-lg px-3 py-1.5 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
        <div className="flex gap-1">
          {roles.map(r => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`text-xs px-3 py-1 rounded-full transition-colors ${
                roleFilter === r
                  ? 'bg-blue-500 text-white'
                  : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        <span className="text-xs text-stone-400 ml-auto">{filtered.length} events</span>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-2xl mx-auto space-y-4">
          {filtered.map(event => (
            <EventCard key={event.id} event={event} />
          ))}
          {filtered.length === 0 && (
            <div className="text-center text-stone-400 py-20 text-sm">No events found.</div>
          )}
        </div>
      </div>
    </div>
  )
}
