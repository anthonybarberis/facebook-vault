import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react'
import { VaultData, ParseProgress } from '../types'
import { parseExport, mergeExports } from '../parser'

type AppState =
  | { phase: 'booting' }
  | { phase: 'setup' }
  | { phase: 'loading'; progress: ParseProgress }
  | { phase: 'ready'; vault: VaultData }
  | { phase: 'error'; message: string }

interface VaultCtx {
  state: AppState
  loadExports: (handles: FileSystemDirectoryHandle[]) => Promise<void>
  reset: () => void
}

const Ctx = createContext<VaultCtx | null>(null)

/** Try to fetch the preprocessed vault-data.json. Returns null if not found. */
async function tryLoadPreprocessed(): Promise<VaultData | null> {
  try {
    const res = await fetch('/vault-data.json', { cache: 'no-cache' })
    if (!res.ok) return null
    const data = await res.json()
    // Basic sanity check
    if (!data.allPosts || !data.allThreads) return null
    // Stub out rootHandle (not needed for preprocessed data — URIs are web paths)
    return data as VaultData
  } catch {
    return null
  }
}

export function VaultProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>({ phase: 'booting' })

  // On mount, try loading preprocessed data first
  useEffect(() => {
    tryLoadPreprocessed().then(vault => {
      if (vault) {
        setState({ phase: 'ready', vault })
      } else {
        setState({ phase: 'setup' })
      }
    })
  }, [])

  const loadExports = useCallback(async (handles: FileSystemDirectoryHandle[]) => {
    setState({ phase: 'loading', progress: { stage: 'Starting…', current: 0, total: handles.length } })

    try {
      const sources = ['export2022', 'export2026'] as const
      const parsed = []

      for (let i = 0; i < handles.length; i++) {
        const source = sources[i] ?? `export${i}` as 'export2022'
        const result = await parseExport(handles[i], source, (p) => {
          setState({ phase: 'loading', progress: { ...p, stage: `Export ${i + 1}: ${p.stage}` } })
        })
        if (result) parsed.push(result)
      }

      if (parsed.length === 0) {
        setState({ phase: 'error', message: 'No valid Facebook export data found. Make sure you selected the right folder(s).' })
        return
      }

      const vault = mergeExports(parsed)
      setState({ phase: 'ready', vault })
    } catch (err) {
      setState({ phase: 'error', message: String(err) })
    }
  }, [])

  const reset = useCallback(() => setState({ phase: 'setup' }), [])

  return <Ctx.Provider value={{ state, loadExports, reset }}>{children}</Ctx.Provider>
}

export function useVault(): VaultCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useVault must be used within VaultProvider')
  return ctx
}
