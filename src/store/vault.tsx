import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { VaultData, ParseProgress } from '../types'
import { parseExport, mergeExports } from '../parser'

type AppState =
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

export function VaultProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>({ phase: 'setup' })

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
