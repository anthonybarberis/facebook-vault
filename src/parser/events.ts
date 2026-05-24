import { FBEvent, FBPageLike, ExportSource, ExportFormat } from '../types'
import { readJson, getDir, listFiles } from '../utils/fs'
import { fixMojibakeDeep } from '../utils/mojibake'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any

function rawToEvent(raw: Raw, role: FBEvent['role'], source: ExportSource, idx: number): FBEvent {
  return {
    id: `${source}:event:${raw.start_timestamp ?? idx}:${idx}`,
    name: raw.name ?? 'Untitled Event',
    startTimestamp: raw.start_timestamp ?? raw.create_timestamp ?? 0,
    endTimestamp: raw.end_timestamp || undefined,
    description: raw.description,
    place: raw.place ? {
      name: raw.place.name ?? '',
      address: raw.place.address,
      latitude: raw.place.coordinate?.latitude,
      longitude: raw.place.coordinate?.longitude,
    } : undefined,
    rsvp: raw.rsvp_status ?? raw.response,
    role,
    source,
  }
}

export async function parseEvents(
  root: FileSystemDirectoryHandle,
  format: ExportFormat,
  source: ExportSource
): Promise<FBEvent[]> {
  const events: FBEvent[] = []

  const eventsDir = format === '2022'
    ? await getDir(root, 'events')
    : await getDir(root, 'your_facebook_activity', 'events')

  if (!eventsDir) return events

  const files = await listFiles(eventsDir)

  for (const fh of files) {
    if (!fh.name.endsWith('.json')) continue
    try {
      const file = await fh.getFile()
      const text = await file.text()
      const data = format === '2022'
        ? fixMojibakeDeep(JSON.parse(text)) as Raw
        : JSON.parse(text) as Raw

      // Determine role from filename
      let role: FBEvent['role'] = 'invited'
      if (fh.name.includes('your_events') || fh.name.includes('events_you_hosted')) role = 'hosted'
      if (fh.name.includes('responses') || fh.name.includes('event_responses')) role = 'responded'
      if (fh.name.includes('your_events') && format === '2022') role = 'created'

      // Try different key names
      const list: Raw[] =
        data?.your_events ??
        data?.events_hosted ??
        data?.events_joined ??
        data?.event_responses ??
        data?.event_invitations ??
        (Array.isArray(data) ? data : [])

      list.forEach((r: Raw, i: number) => {
        if (r.name || r.start_timestamp) {
          events.push(rawToEvent(r, role, source, events.length + i))
        }
      })
    } catch { /* skip */ }
  }

  return events.sort((a, b) => b.startTimestamp - a.startTimestamp)
}

export async function parsePageLikes(
  root: FileSystemDirectoryHandle,
  format: ExportFormat,
  source: ExportSource
): Promise<FBPageLike[]> {
  const likes: FBPageLike[] = []

  if (format === '2022') {
    const data = await readJson<Raw>(root, 'likes_and_reactions', 'pages.json')
    const fixed = fixMojibakeDeep(data) as Raw
    const list: Raw[] = fixed?.page_likes ?? []
    list.forEach((r: Raw, i: number) => {
      likes.push({ id: `${source}:pagelike:${i}`, name: r.name, timestamp: r.timestamp ?? 0, source })
    })
  } else {
    const data = await readJson<Raw>(
      root, 'your_facebook_activity', 'pages', "pages_you've_liked.json"
    )
    const list: Raw[] = (data as Raw)?.page_likes ?? []
    list.forEach((r: Raw, i: number) => {
      likes.push({ id: `${source}:pagelike:${i}`, name: r.name, timestamp: r.timestamp ?? 0, source })
    })
  }

  return likes.sort((a, b) => b.timestamp - a.timestamp)
}
