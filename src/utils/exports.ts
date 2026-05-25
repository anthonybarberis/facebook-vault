/** Shared helpers for display of multiple exports. */

export const EXPORT_COLORS = [
  { badge: 'bg-violet-100 text-violet-600', dot: 'bg-violet-400', chart: '#8b5cf6' },
  { badge: 'bg-emerald-100 text-emerald-600', dot: 'bg-emerald-400', chart: '#10b981' },
  { badge: 'bg-blue-100 text-blue-600',    dot: 'bg-blue-400',    chart: '#3b82f6' },
  { badge: 'bg-amber-100 text-amber-600',  dot: 'bg-amber-400',   chart: '#f59e0b' },
  { badge: 'bg-rose-100 text-rose-600',    dot: 'bg-rose-400',    chart: '#ec4899' },
]

export interface ExportMeta {
  source: string
  format: string
}

/** Return the 0-based index of a source within the loaded exports list. */
export function exportIndex(source: string, exports: ExportMeta[]): number {
  const idx = exports.findIndex(e => e.source === source)
  return idx >= 0 ? idx : 0
}

/** Color palette entry for a given source. */
export function exportColor(source: string, exports: ExportMeta[]) {
  const idx = exportIndex(source, exports)
  return EXPORT_COLORS[idx % EXPORT_COLORS.length]
}

/**
 * Short label for a source badge.
 * Returns null when there is only one export (no badge needed).
 * Uses format year when formats are all distinct, otherwise uses '#N'.
 */
export function exportLabel(source: string, exports: ExportMeta[]): string | null {
  if (exports.length <= 1) return null
  const idx = exportIndex(source, exports)
  const fmt = exports[idx]?.format
  const formats = exports.map(e => e.format)
  const formatsDistinct = new Set(formats).size === formats.length
  if (formatsDistinct) {
    if (fmt === '2022') return "'22"
    if (fmt === '2026') return "'26"
  }
  return `#${idx + 1}`
}
