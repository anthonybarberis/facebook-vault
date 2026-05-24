import { useState } from 'react'
import { VaultProvider, useVault } from './store/vault'
import Setup from './views/Setup'
import Loading from './views/Loading'
import Layout, { ViewName } from './views/Layout'
import Timeline from './views/Timeline'
import Albums from './views/Albums'
import Messages from './views/Messages'
import Events from './views/Events'
import People from './views/People'
import Activity from './views/Activity'
import Stats from './views/Stats'

function AppInner() {
  const { state } = useVault()
  const [view, setView] = useState<ViewName>('timeline')

  if (state.phase === 'booting') return <Loading progress={{ stage: 'Loading your archive…', current: 0, total: 1 }} />
  if (state.phase === 'setup') return <Setup />
  if (state.phase === 'loading') return <Loading progress={state.progress} />
  if (state.phase === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="max-w-md text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-lg font-semibold text-stone-800 mb-2">Something went wrong</h2>
          <p className="text-stone-500 text-sm mb-6">{state.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-blue-700"
          >
            Start over
          </button>
        </div>
      </div>
    )
  }

  return (
    <Layout view={view} onView={setView}>
      {view === 'timeline' && <Timeline />}
      {view === 'albums' && <Albums />}
      {view === 'messages' && <Messages />}
      {view === 'events' && <Events />}
      {view === 'people' && <People />}
      {view === 'activity' && <Activity />}
      {view === 'stats' && <Stats />}
    </Layout>
  )
}

export default function App() {
  return (
    <VaultProvider>
      <AppInner />
    </VaultProvider>
  )
}
