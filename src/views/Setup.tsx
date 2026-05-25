import { useState } from 'react'
import { useVault } from '../store/vault'
import { detectFormat } from '../parser'

interface PickedFolder {
  handle: FileSystemDirectoryHandle
  format: string
  name: string
}

const SUPPORTED = 'showDirectoryPicker' in window

export default function Setup() {
  const { loadExports } = useVault()
  const [folders, setFolders] = useState<PickedFolder[]>([])
  const [picking, setPicking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function pickFolder() {
    if (!SUPPORTED) return
    setPicking(true)
    setError(null)
    try {
      const handle = await (window as unknown as { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker()
      const format = await detectFormat(handle)
      if (!format) {
        setError(`"${handle.name}" doesn't look like a Facebook export. Select a folder that contains your Facebook data directly (e.g. profile_information, posts, your_facebook_activity).`)
        setPicking(false)
        return
      }
      setFolders(prev => [...prev, { handle, format, name: handle.name }])
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== 'AbortError') {
        setError(String(e))
      }
    }
    setPicking(false)
  }

  function removeFolder(idx: number) {
    setFolders(prev => prev.filter((_, i) => i !== idx))
  }

  function handleLoad() {
    if (folders.length === 0) return
    loadExports(folders.map(f => f.handle))
  }

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center px-6 py-16">
      <div className="max-w-lg w-full">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="text-6xl mb-4">📦</div>
          <h1 className="text-4xl font-bold text-stone-900 mb-2 tracking-tight">Vault</h1>
          <p className="text-stone-500 text-lg">Your Facebook archive, beautifully explored.</p>
        </div>

        {/* Instructions */}
        <div className="bg-white rounded-2xl border border-stone-200 p-6 mb-6 shadow-sm">
          <h2 className="font-semibold text-stone-800 mb-3 flex items-center gap-2">
            <span className="text-blue-500">①</span> Add your export folder(s)
          </h2>
          <p className="text-stone-500 text-sm mb-4">
            Select the folder(s) containing your Facebook data export. You can load one or two exports — Vault will merge them into a single timeline.
          </p>

          {!SUPPORTED && (
            <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              <span className="font-semibold">Chrome or Edge required.</span>{' '}
              This app uses the File System Access API to read your export locally without uploading it.
              Firefox and Safari don't support this API yet — please open this page in{' '}
              <a href="https://www.google.com/chrome/" target="_blank" rel="noopener noreferrer" className="underline hover:text-amber-900">Chrome</a>
              {' '}or{' '}
              <a href="https://www.microsoft.com/edge" target="_blank" rel="noopener noreferrer" className="underline hover:text-amber-900">Edge</a>.
            </div>
          )}
          <div className="text-sm text-stone-400 bg-stone-50 rounded-lg p-3 mb-4 font-mono">
            <div className="text-stone-500 mb-1 font-sans font-medium">Which folder to select:</div>
            <div>📁 facebook-your_name-json-2021.XXXX/</div>
            <div>📁 facebook export current 2026.XX/</div>
          </div>

          {/* Picked folders */}
          {folders.length > 0 && (
            <div className="mb-4 space-y-2">
              {folders.map((f, i) => (
                <div key={i} className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                  <span className="text-green-500">✓</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-stone-800 truncate">{f.name}</div>
                    <div className="text-xs text-stone-400">{f.format} format detected</div>
                  </div>
                  <button
                    onClick={() => removeFolder(i)}
                    className="text-stone-400 hover:text-red-500 text-sm ml-1"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={pickFolder}
            disabled={!SUPPORTED || picking}
            className="w-full border-2 border-dashed border-stone-300 rounded-xl py-3 px-4 text-stone-500 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            {picking ? 'Opening folder picker…' : folders.length === 0 ? '+ Add export folder' : '+ Add another export'}
          </button>

          {error && (
            <div className="mt-3 text-sm text-red-600 bg-red-50 rounded-lg p-3">
              {error}
            </div>
          )}
        </div>

        {/* Load button */}
        <button
          onClick={handleLoad}
          disabled={folders.length === 0}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-stone-300 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-2xl transition-colors text-lg shadow-sm"
        >
          {folders.length === 0 ? 'Add a folder to continue' : `Load ${folders.length} ${folders.length === 1 ? 'export' : 'exports'} →`}
        </button>

        {/* Privacy note */}
        <p className="text-center text-xs text-stone-400 mt-6">
          🔒 Everything stays local. No data is uploaded or sent anywhere.
          Works in Chrome and Edge only (File System Access API).
        </p>
      </div>
    </div>
  )
}
