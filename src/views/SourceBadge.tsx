import { useVault } from '../store/vault'
import { exportColor, exportLabel } from '../utils/exports'

/** Inline source badge — renders nothing when only one export is loaded. */
export default function SourceBadge({ source }: { source: string }) {
  const { state } = useVault()
  const exports = state.phase === 'ready' ? state.vault.exports : []
  const label = exportLabel(source, exports)
  if (!label) return null
  const { badge } = exportColor(source, exports)
  return (
    <span className={`inline-block text-xs px-1.5 py-0.5 rounded font-mono ${badge}`}>
      {label}
    </span>
  )
}
