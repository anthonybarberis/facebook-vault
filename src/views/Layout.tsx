import { ReactNode, useState } from 'react'
import { useVault } from '../store/vault'
import { VaultData } from '../types'
import { pluralize } from '../utils/format'

export type ViewName = 'timeline' | 'albums' | 'messages' | 'events' | 'people' | 'activity' | 'stats'

interface NavItem {
  id: ViewName
  label: string
  icon: string
  count?: number
}

function navItems(vault: VaultData): NavItem[] {
  return [
    { id: 'timeline', label: 'Timeline', icon: '📜', count: vault.allPosts.length },
    { id: 'albums', label: 'Albums', icon: '📷', count: vault.allAlbums.reduce((s, a) => s + a.photos.length, 0) },
    { id: 'messages', label: 'Messages', icon: '💬', count: vault.allThreads.length },
    { id: 'events', label: 'Events', icon: '📅', count: vault.allEvents.length },
    { id: 'people', label: 'People', icon: '👥', count: vault.allFriends.length },
    { id: 'activity', label: 'Activity', icon: '❤️', count: vault.allComments.length + vault.allReactions.length },
    { id: 'stats', label: 'Stats', icon: '📊' },
  ]
}

interface Props {
  view: ViewName
  onView: (v: ViewName) => void
  children: ReactNode
}

export default function Layout({ view, onView, children }: Props) {
  const { state, reset } = useVault()
  const vault = state.phase === 'ready' ? state.vault : null
  const [sidebarOpen, setSidebarOpen] = useState(true)

  if (!vault) return null

  const items = navItems(vault)
  const profile = vault.profiles[0]

  return (
    <div className="flex h-screen bg-stone-100 overflow-hidden">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-56' : 'w-16'} flex-shrink-0 bg-white border-r border-stone-200 flex flex-col transition-all duration-200`}>
        {/* Logo / collapse */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-stone-100">
          {sidebarOpen && (
            <div>
              <div className="font-bold text-stone-900 text-sm">📦 Vault</div>
              {profile && <div className="text-xs text-stone-400 truncate">{profile.name}</div>}
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(o => !o)}
            className="text-stone-400 hover:text-stone-700 p-1 rounded"
          >
            {sidebarOpen ? '◀' : '▶'}
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-3 overflow-y-auto">
          {items.map(item => (
            <button
              key={item.id}
              onClick={() => onView(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors
                ${view === item.id
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'
                }`}
            >
              <span className="text-base flex-shrink-0">{item.icon}</span>
              {sidebarOpen && (
                <div className="flex-1 flex items-center justify-between min-w-0">
                  <span className="text-sm truncate">{item.label}</span>
                  {item.count !== undefined && (
                    <span className="text-xs text-stone-400 ml-1 flex-shrink-0">
                      {item.count.toLocaleString()}
                    </span>
                  )}
                </div>
              )}
            </button>
          ))}
        </nav>

        {/* Export badges */}
        {sidebarOpen && (
          <div className="p-4 border-t border-stone-100 space-y-1">
            {vault.exports.map(exp => (
              <div key={exp.source} className="flex items-center gap-2 text-xs text-stone-400">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${exp.source === 'export2022' ? 'bg-violet-400' : 'bg-emerald-400'}`} />
                <span className="truncate">{exp.format} export · {pluralize(exp.posts.length, 'post')}</span>
              </div>
            ))}
            <button
              onClick={reset}
              className="text-xs text-stone-400 hover:text-red-500 mt-2 block"
            >
              ← Change exports
            </button>
          </div>
        )}
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  )
}
