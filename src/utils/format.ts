/** Format a Unix timestamp (seconds) as a human-readable date string. */
export function formatDate(ts: number, opts?: Intl.DateTimeFormatOptions): string {
  return new Date(ts * 1000).toLocaleDateString('en-US', opts ?? {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function formatDateShort(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function formatYear(ts: number): number {
  return new Date(ts * 1000).getFullYear()
}

export function formatMonth(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
}

/** Format a timestamp_ms (milliseconds) as a time string. */
export function formatTime(tsMs: number): string {
  return new Date(tsMs).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export function formatDateTime(tsMs: number): string {
  return new Date(tsMs).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

/** Relative time (e.g. "3 years ago") */
export function timeAgo(ts: number): string {
  const now = Date.now()
  const diff = now - ts * 1000
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  const months = Math.floor(days / 30)
  const years = Math.floor(days / 365)

  if (years > 0) return `${years} year${years > 1 ? 's' : ''} ago`
  if (months > 0) return `${months} month${months > 1 ? 's' : ''} ago`
  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`
  return 'just now'
}

export function pluralize(n: number, singular: string, plural?: string): string {
  return `${n.toLocaleString()} ${n === 1 ? singular : (plural ?? singular + 's')}`
}

export const REACTION_EMOJI: Record<string, string> = {
  Like: '👍',
  Love: '❤️',
  Haha: '😂',
  Wow: '😮',
  Sad: '😢',
  Angry: '😡',
  Care: '🤗',
}
