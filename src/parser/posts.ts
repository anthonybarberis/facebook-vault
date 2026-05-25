import { FBPost, FBPostAttachment, ExportSource, ExportFormat } from '../types'
import { readJson, getDir, listFiles } from '../utils/fs'
import { fixMojibakeDeep } from '../utils/mojibake'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any

// ─── Attachment parsing ───────────────────────────────────────────────────────

function parseAttachments(rawAttachments: Raw[]): FBPostAttachment[] {
  if (!Array.isArray(rawAttachments)) return []
  const out: FBPostAttachment[] = []

  for (const att of rawAttachments) {
    const items: Raw[] = att?.data ?? []
    const textItems = items.filter((i: Raw) => i?.text && !i?.media && !i?.external_context)

    for (const item of items) {
      if (item?.media) {
        const m = item.media
        const isVideo = /\.(mp4|mov|avi|mkv|webm)$/i.test(m.uri ?? '')
        out.push({
          type: isVideo ? 'video' : 'photo',
          uri: m.uri,
          mediaTitle: m.title,
          description: m.description,
        })
      } else if (item?.external_context) {
        out.push({
          type: 'link',
          url: item.external_context.url,
          linkTitle: item.external_context.name,
          linkDescription: item.external_context.description,
        })
      } else if (item?.place) {
        const pl = item.place
        out.push({
          type: 'place',
          placeName: pl.name,
          placeAddress: pl.address,
          latitude: pl.coordinate?.latitude,
          longitude: pl.coordinate?.longitude,
        })
      } else if (item?.event) {
        out.push({ type: 'event', eventName: item.event.name, eventStart: item.event.start_timestamp })
      } else if (item?.life_event) {
        out.push({ type: 'life_event', lifeEventTitle: item.life_event.title })
      } else if (item?.poll) {
        out.push({ type: 'poll', pollQuestion: item.poll.question })
      }
    }

    // Standalone text-only items → info card
    if (textItems.length > 0 && textItems.length === items.length) {
      out.push({ type: 'info', lines: textItems.map((i: Raw) => i.text) })
    }
  }

  return out
}

// ─── Single post normalisation ────────────────────────────────────────────────

function rawToPost(raw: Raw, source: ExportSource, idx: number): FBPost {
  const text = raw.data?.find((d: Raw) => d.post)?.post
  const tags = (raw.tags ?? []).map((t: Raw) => t.name).filter(Boolean)
  return {
    id: `${source}:post:${raw.timestamp ?? idx}:${idx}`,
    timestamp: raw.timestamp ?? 0,
    text,
    title: raw.title,
    attachments: parseAttachments(raw.attachments ?? []),
    ...(tags.length ? { tags } : {}),
    source,
  }
}

// ─── Post-processing: dedup, GIF filter, album merge ─────────────────────────

const GIF_URL_RE  = /\.(gif)($|\?|#)/i
const GIF_HOST_RE = /\b(tenor\.co|giphy\.com)\b/i
const ALBUM_TITLE_RE = /\badded (a new|\d+ new) photos?\b/i
const GAP_SEC = 600 // 10 min gap = separate upload session

function postProcess(posts: FBPost[]): FBPost[] {
  // 1. Build set of (timestamp::url) pairs that appear in text posts
  //    so we can drop bare link-only duplicates.
  const textPostLinks = new Set<string>()
  for (const p of posts) {
    if (!p.text) continue
    for (const a of p.attachments) {
      if (a.type === 'link' && a.url) textPostLinks.add(`${p.timestamp}::${a.url}`)
    }
  }

  // 2. Dedup + filter
  const deduped = posts.filter(p => {
    if (p.text) return true
    const linkAtts    = p.attachments.filter(a => a.type === 'link')
    const nonLinkAtts = p.attachments.filter(a => a.type !== 'link')

    // Drop GIF-reaction artifacts: no text, only a GIF CDN link
    if (
      linkAtts.length > 0 && nonLinkAtts.length === 0 &&
      linkAtts.every(a => a.url && (GIF_URL_RE.test(a.url) || GIF_HOST_RE.test(a.url)))
    ) return false

    if (nonLinkAtts.length > 0) return true
    if (p.attachments.length === 0) return false

    // Drop link-only stub if every URL already appears in a text post at same timestamp
    return !linkAtts.every(a => a.url && textPostLinks.has(`${p.timestamp}::${a.url}`))
  })

  // 3. Merge album photo posts (Facebook serialises bulk uploads as one post per photo)
  const albumCandidates: FBPost[] = []
  const rest: FBPost[] = []

  for (const p of deduped) {
    const photoAtts = p.attachments.filter(a => a.type === 'photo')
    if (!p.text && photoAtts.length >= 1 && ALBUM_TITLE_RE.test(p.title ?? '')) {
      albumCandidates.push(p)
    } else {
      rest.push(p)
    }
  }

  albumCandidates.sort((a, b) => a.timestamp - b.timestamp)

  // Group by (source, title, album name from first photo's mediaTitle)
  const groupMap = new Map<string, FBPost[]>()
  for (const p of albumCandidates) {
    const albumName = p.attachments.find(a => a.type === 'photo')?.mediaTitle ?? ''
    const key = `${p.source}::${p.title}::${albumName}`
    if (!groupMap.has(key)) groupMap.set(key, [])
    groupMap.get(key)!.push(p)
  }

  for (const group of groupMap.values()) {
    // Split on time gaps → separate upload sessions
    const sessions: FBPost[][] = [[group[0]]]
    for (let i = 1; i < group.length; i++) {
      if (group[i].timestamp - group[i - 1].timestamp > GAP_SEC) sessions.push([group[i]])
      else sessions[sessions.length - 1].push(group[i])
    }
    for (const session of sessions) {
      if (session.length === 1) {
        rest.push(session[0])
      } else {
        const photoAtts = session.flatMap(p => p.attachments.filter(a => a.type === 'photo'))
        const placeAtt  = session[0].attachments.find(a => a.type === 'place')
        rest.push({ ...session[0], attachments: placeAtt ? [...photoAtts, placeAtt] : photoAtts })
      }
    }
  }

  return rest.sort((a, b) => b.timestamp - a.timestamp)
}

// ─── Main parser ──────────────────────────────────────────────────────────────

export async function parsePosts(
  root: FileSystemDirectoryHandle,
  format: ExportFormat,
  source: ExportSource
): Promise<FBPost[]> {
  const posts: FBPost[] = []

  if (format === '2022') {
    const postsDir = await getDir(root, 'posts')
    if (!postsDir) return posts
    const files = (await listFiles(postsDir))
      .filter(f => /^your_posts_\d+\.json$/.test(f.name))
      .sort((a, b) => a.name.localeCompare(b.name))

    for (const fh of files) {
      try {
        const raw = fixMojibakeDeep(JSON.parse(await (await fh.getFile()).text())) as Raw[]
        if (Array.isArray(raw)) raw.forEach((r, i) => posts.push(rawToPost(r, source, posts.length + i)))
      } catch { /* skip bad file */ }
    }
  } else {
    const postsDir = await getDir(root, 'your_facebook_activity', 'posts')
    if (!postsDir) return posts
    const files = (await listFiles(postsDir))
      .filter(f => /your_posts.*\.json$/.test(f.name))
      .sort((a, b) => a.name.localeCompare(b.name))

    for (const fh of files) {
      try {
        const raw = JSON.parse(await (await fh.getFile()).text()) as Raw[]
        if (Array.isArray(raw)) raw.forEach((r, i) => posts.push(rawToPost(r, source, posts.length + i)))
      } catch { /* skip bad file */ }
    }
  }

  return postProcess(posts)
}
