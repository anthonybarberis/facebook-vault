/**
 * Vault preprocessor — reads both Facebook export folders, normalizes the data,
 * and writes public/vault-data.json + symlinks for photo serving.
 *
 * Usage:
 *   node scripts/preprocess.mjs <path-to-export-1> [path-to-export-2]
 *
 * The script auto-detects which format each export is (2022 vs 2026).
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const VAULT_ROOT = path.join(__dirname, '..')
const PUBLIC_DIR = path.join(VAULT_ROOT, 'public')
const EXPORTS_DIR = path.join(PUBLIC_DIR, 'exports')
const OUTPUT_FILE = path.join(PUBLIC_DIR, 'vault-data.json')

// ─── CLI args ─────────────────────────────────────────────────────────────────

const args = process.argv.slice(2).filter(a => !a.startsWith('--'))
if (args.length === 0) {
  console.error('Usage: node scripts/preprocess.mjs <export-dir> [export-dir-2]')
  process.exit(1)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch {
    return null
  }
}

function fixMojibake(str) {
  if (typeof str !== 'string') return str
  let needsFix = false
  for (let i = 0; i < str.length; i++) {
    if (str.charCodeAt(i) > 127) { needsFix = true; break }
  }
  if (!needsFix) return str
  try {
    const bytes = Buffer.from(str.split('').map(c => c.charCodeAt(0) & 0xff))
    return bytes.toString('utf8')
  } catch {
    return str
  }
}

function fixDeep(obj) {
  if (typeof obj === 'string') return fixMojibake(obj)
  if (Array.isArray(obj)) return obj.map(fixDeep)
  if (obj && typeof obj === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(obj)) out[k] = fixDeep(v)
    return out
  }
  return obj
}

function detectFormat(root) {
  if (fs.existsSync(path.join(root, 'your_facebook_activity'))) return '2026'
  if (fs.existsSync(path.join(root, 'posts'))) return '2022'
  if (fs.existsSync(path.join(root, 'profile_information'))) return '2022'
  if (fs.existsSync(path.join(root, 'messages'))) return '2022'
  return null
}

function listJsonFiles(dir) {
  try {
    return fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => path.join(dir, f))
  } catch { return [] }
}

function listDirs(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => path.join(dir, e.name))
  } catch { return [] }
}

// ─── Parsers ──────────────────────────────────────────────────────────────────

function parseProfile(root, format, source) {
  let raw = null
  if (format === '2022') {
    const data = readJson(path.join(root, 'profile_information', 'profile_information.json'))
    raw = data ? fixDeep(data).profile : null
  } else {
    const data = readJson(path.join(root, 'personal_information', 'profile_information', 'profile_information.json'))
    raw = data?.profile_v2 ?? data?.profile ?? null
  }
  if (!raw) return null
  return {
    name: raw.name?.full_name ?? '',
    emails: [...(raw.emails?.emails ?? []), ...(raw.emails?.previous_emails ?? [])],
    birthday: raw.birthday,
    currentCity: raw.current_city?.name,
    hometown: raw.hometown?.name,
    relationship: raw.relationship ? { status: raw.relationship.status, partner: raw.relationship.partner } : undefined,
    education: (raw.education_experiences ?? raw.education ?? []).map(e => ({ name: e.name ?? '', type: e.school_type ?? 'School', graduated: e.graduated ?? false })),
    source,
  }
}

function parseAttachments(rawAttachments, webBase) {
  if (!Array.isArray(rawAttachments)) return []
  const out = []
  for (const att of rawAttachments) {
    const items = att?.data ?? []
    // Collect loose text items (e.g. Spotify share: service, track, artist)
    const textItems = items.filter(item => item?.text && !item?.media && !item?.external_context)
    for (const item of items) {
      if (item?.media) {
        const m = item.media
        const isVideo = m.uri?.match(/\.(mp4|mov|avi|mkv|webm)$/i)
        out.push({ type: isVideo ? 'video' : 'photo', uri: m.uri ? `${webBase}/${m.uri}` : undefined, mediaTitle: m.title, description: m.description })
      } else if (item?.external_context) {
        out.push({ type: 'link', url: item.external_context.url, linkTitle: item.external_context.name, linkDescription: item.external_context.description })
      } else if (item?.place) {
        const pl = item.place
        out.push({ type: 'place', placeName: pl.name, placeAddress: pl.address, latitude: pl.coordinate?.latitude, longitude: pl.coordinate?.longitude })
      } else if (item?.event) {
        out.push({ type: 'event', eventName: item.event.name, eventStart: item.event.start_timestamp })
      } else if (item?.life_event) {
        out.push({ type: 'life_event', lifeEventTitle: item.life_event.title })
      } else if (item?.poll) {
        out.push({ type: 'poll', pollQuestion: item.poll.question })
      }
    }
    // If the only items were text metadata (no URL, no media), emit a single info attachment
    if (textItems.length > 0 && textItems.length === items.length) {
      out.push({ type: 'info', lines: textItems.map(i => i.text) })
    }
  }
  return out
}

function parsePosts(root, format, source, webBase) {
  const posts = []
  let dir, pattern
  if (format === '2022') {
    dir = path.join(root, 'posts')
    pattern = /^your_posts_\d+\.json$/
  } else {
    dir = path.join(root, 'your_facebook_activity', 'posts')
    pattern = /your_posts.*\.json$/
  }
  const files = listJsonFiles(dir).filter(f => pattern.test(path.basename(f))).sort()
  for (const file of files) {
    let raw = readJson(file)
    if (!Array.isArray(raw)) continue
    raw = fixDeep(raw)
    raw.forEach((r, i) => {
      const text = r.data?.find(d => d.post)?.post
      const tags = (r.tags ?? []).map(t => t.name).filter(Boolean)
      posts.push({ id: `${source}:post:${r.timestamp ?? i}:${posts.length}`, timestamp: r.timestamp ?? 0, text, title: r.title, attachments: parseAttachments(r.attachments ?? [], webBase), ...(tags.length ? { tags } : {}), source })
    })
  }

  // Dedup: remove link-only stubs that are duplicated by a post with text at the same timestamp.
  // Facebook exports sometimes emit a bare link attachment entry AND a full text+link entry for the same share.
  // Build a set of (timestamp, url) pairs that appear in posts which have text.
  const textPostLinks = new Set()
  for (const p of posts) {
    if (!p.text) continue
    for (const att of p.attachments) {
      if (att.type === 'link' && att.url) textPostLinks.add(`${p.timestamp}::${att.url}`)
    }
  }
  // Regex to identify GIF CDN URLs that came from comment GIF reactions (not real posts)
  const gifUrlRe = /\.(gif)($|\?|#)/i
  const gifHostRe = /\b(tenor\.co|giphy\.com)\b/i

  const deduped = posts.filter(p => {
    if (p.text) return true
    const linkAtts = p.attachments.filter(a => a.type === 'link')
    const nonLinkAtts = p.attachments.filter(a => a.type !== 'link')

    // Drop GIF-reaction artifacts: no text, only GIF CDN link (comment GIFs exported as posts)
    if (linkAtts.length > 0 && nonLinkAtts.length === 0 &&
        linkAtts.every(a => a.url && (gifUrlRe.test(a.url) || gifHostRe.test(a.url)))) return false

    // Keep posts with non-link attachments (photos, videos, info cards)
    if (nonLinkAtts.length > 0) return true

    // Drop posts that are entirely empty (no text, no usable attachments after parsing)
    if (p.attachments.length === 0) return false

    // It's a link-only post: drop it if every link URL appears in a text post at the same timestamp
    return !linkAtts.every(a => a.url && textPostLinks.has(`${p.timestamp}::${a.url}`))
  })

  // Merge album photo posts: Facebook serialises bulk photo uploads as one post per photo.
  // Two variants exist:
  //   • Older exports: all photos share the exact same timestamp
  //   • Newer exports: timestamps increment ~1s per photo (sequential upload processing)
  // Strategy: group by (source, title, album name from photo mediaTitle), then split each
  // group on timestamp gaps > 10 min so separate upload sessions stay separate.
  const albumPhotoRe = /\badded (a new|\d+ new) photos?\b/i
  const albumCandidates = []
  const nonGrouped = []
  for (const p of deduped) {
    const photoAtts = p.attachments.filter(a => a.type === 'photo')
    if (!p.text && photoAtts.length >= 1 && albumPhotoRe.test(p.title ?? '')) {
      albumCandidates.push(p)
    } else {
      nonGrouped.push(p)
    }
  }

  albumCandidates.sort((a, b) => a.timestamp - b.timestamp)
  const albumGroupMap = new Map()
  for (const p of albumCandidates) {
    const albumName = p.attachments.find(a => a.type === 'photo')?.mediaTitle ?? ''
    const key = `${p.source}::${p.title}::${albumName}`
    if (!albumGroupMap.has(key)) albumGroupMap.set(key, [])
    albumGroupMap.get(key).push(p)
  }

  const GAP_SEC = 600 // >10 min between photos = treat as a separate upload session
  for (const group of albumGroupMap.values()) {
    // Split into upload sessions on timestamp gaps
    const sessions = [[group[0]]]
    for (let i = 1; i < group.length; i++) {
      if (group[i].timestamp - group[i - 1].timestamp > GAP_SEC) sessions.push([group[i]])
      else sessions[sessions.length - 1].push(group[i])
    }
    for (const session of sessions) {
      if (session.length === 1) {
        nonGrouped.push(session[0])
      } else {
        const photoAtts = session.flatMap(p => p.attachments.filter(a => a.type === 'photo'))
        const placeAtt  = session[0].attachments.find(a => a.type === 'place')
        nonGrouped.push({
          ...session[0],
          attachments: placeAtt ? [...photoAtts, placeAtt] : photoAtts,
        })
      }
    }
  }

  return nonGrouped.sort((a, b) => b.timestamp - a.timestamp)
}

function parseComments(root, format, source) {
  const comments = []
  let raw
  if (format === '2022') {
    const data = readJson(path.join(root, 'comments', 'comments.json'))
    raw = fixDeep(data)?.comments ?? []
  } else {
    const data = readJson(path.join(root, 'your_facebook_activity', 'comments_and_reactions', 'comments.json'))
    const fixed = fixDeep(data)
    raw = fixed?.comments_v2 ?? (Array.isArray(fixed) ? fixed : [])
    // also group comments
    const gdata = readJson(path.join(root, 'your_facebook_activity', 'groups', 'your_comments_in_groups.json'))
    raw = [...raw, ...(fixDeep(gdata)?.group_comments_v2 ?? [])]
  }
  raw.forEach((r, i) => {
    const cd = r?.data?.find(d => d.comment)?.comment
    if (!cd) return
    const text = cd.comment ?? cd.text
    if (!text) return
    comments.push({ id: `${source}:comment:${r.timestamp ?? i}:${i}`, timestamp: r.timestamp ?? cd.timestamp ?? 0, text, author: cd.author ?? '', title: r.title, source })
  })
  return comments.sort((a, b) => b.timestamp - a.timestamp)
}

function parseReactions(root, format, source) {
  const reactions = []
  if (format === '2022') {
    const data = readJson(path.join(root, 'likes_and_reactions', 'posts_and_comments.json'))
    const fixed = fixDeep(data)
    for (const [i, item] of (fixed?.reactions ?? []).entries()) {
      reactions.push({ id: `${source}:reaction:${item.timestamp ?? i}:${i}`, timestamp: item.timestamp ?? 0, reaction: item.data?.[0]?.reaction?.reaction ?? 'Like', title: item.title, source })
    }
  } else {
    const dir = path.join(root, 'your_facebook_activity', 'comments_and_reactions')
    const files = listJsonFiles(dir).filter(f => path.basename(f).match(/^likes_and_reactions/)).sort()
    for (const file of files) {
      const list = readJson(file)
      if (!Array.isArray(list)) continue
      list.forEach((item, i) => {
        const rxn = item.label_values?.find(lv => lv?.label === 'Reaction')?.value ?? 'Like'
        const urlEntry = item.label_values?.find(lv => lv?.label === 'URL')
        const owner = item.label_values?.find(lv => lv?.title === 'Owner')
        const targetName = owner?.dict?.[0]?.dict?.find(d => d.label === 'Name')?.value
        reactions.push({ id: `${source}:reaction:${item.timestamp ?? i}:${reactions.length}`, timestamp: item.timestamp ?? 0, reaction: rxn, title: item.title, targetName, url: urlEntry?.value, source })
      })
    }
  }
  return reactions.sort((a, b) => b.timestamp - a.timestamp)
}

function parsePhotos(root, format, source, webBase) {
  const albums = []
  const albumDir = format === '2022'
    ? path.join(root, 'photos_and_videos', 'album')
    : path.join(root, 'your_facebook_activity', 'posts', 'album')

  const files = listJsonFiles(albumDir).filter(f => path.basename(f).match(/^\d+\.json$/)).sort((a, b) => parseInt(path.basename(a)) - parseInt(path.basename(b)))

  for (const file of files) {
    let raw = readJson(file)
    if (!raw) continue
    if (format === '2022') raw = fixDeep(raw)
    const name = raw.name ?? 'Untitled Album'
    const photos = (raw.photos ?? []).map((p, i) => {
      const meta = p?.media_metadata?.photo_metadata ?? {}
      const exif = meta?.exif_data?.[0] ?? meta
      return {
        id: `${source}:photo:${p.creation_timestamp ?? i}:${i}`,
        uri: p.uri ? `${webBase}/${p.uri}` : '',
        albumName: name,
        creationTimestamp: p.creation_timestamp ?? 0,
        takenTimestamp: exif.taken_timestamp,
        title: p.title,
        description: p.description,
        latitude: exif.latitude,
        longitude: exif.longitude,
        cameraMake: exif.camera_make,
        cameraModel: exif.camera_model,
        width: exif.original_width,
        height: exif.original_height,
        source,
      }
    })
    if (photos.length > 0) albums.push({ id: `${source}:album:${name}`, name, photos, source })
  }
  return albums
}

function parseFriends(root, format, source) {
  let raw = []
  if (format === '2022') {
    const data = readJson(path.join(root, 'friends', 'friends.json'))
    raw = fixDeep(data)?.friends ?? []
  } else {
    const data = readJson(path.join(root, 'connections', 'friends', 'your_friends.json'))
    raw = data?.friends_v2 ?? []
  }
  return raw.filter(r => r.name).map((r, i) => ({ id: `${source}:friend:${i}`, name: r.name, timestamp: r.timestamp ?? 0, source })).sort((a, b) => b.timestamp - a.timestamp)
}

function parseEvents(root, format, source) {
  const events = []
  const eventsDir = format === '2022' ? path.join(root, 'events') : path.join(root, 'your_facebook_activity', 'events')
  if (!fs.existsSync(eventsDir)) return events
  for (const file of listJsonFiles(eventsDir)) {
    let data = readJson(file)
    if (!data) continue
    if (format === '2022') data = fixDeep(data)
    const fname = path.basename(file)
    let role = 'invited'
    if (fname.includes('your_events') || fname.includes('events_you_hosted')) role = fname.includes('hosted') ? 'hosted' : 'created'
    if (fname.includes('responses')) role = 'responded'
    const raw = data?.your_events ?? data?.events_hosted ?? data?.events_joined ?? data?.event_responses ?? data?.event_invitations ?? (Array.isArray(data) ? data : null)
    const list = Array.isArray(raw) ? raw : []
    list.forEach((r, i) => {
      if (!r.name && !r.start_timestamp) return
      events.push({ id: `${source}:event:${r.start_timestamp ?? i}:${events.length}`, name: r.name ?? 'Untitled', startTimestamp: r.start_timestamp ?? r.create_timestamp ?? 0, endTimestamp: r.end_timestamp || undefined, description: r.description, place: r.place ? { name: r.place.name ?? '', address: r.place.address, latitude: r.place.coordinate?.latitude, longitude: r.place.coordinate?.longitude } : undefined, rsvp: r.rsvp_status, role, source })
    })
  }
  return events.sort((a, b) => b.startTimestamp - a.startTimestamp)
}

function parsePageLikes(root, format, source) {
  let list = []
  if (format === '2022') {
    const data = readJson(path.join(root, 'likes_and_reactions', 'pages.json'))
    list = fixDeep(data)?.page_likes ?? []
  } else {
    const data = readJson(path.join(root, 'your_facebook_activity', 'pages', "pages_you've_liked.json"))
    list = data?.page_likes ?? []
  }
  return list.map((r, i) => ({ id: `${source}:pagelike:${i}`, name: r.name, timestamp: r.timestamp ?? 0, source })).sort((a, b) => b.timestamp - a.timestamp)
}

function parseMessages(root, format, source, webBase, selfName) {
  const threads = []
  const msgBase = format === '2022' ? path.join(root, 'messages') : path.join(root, 'your_facebook_activity', 'messages')
  const ME = selfName ?? ''

  const cats = [
    { dir: 'inbox', category: 'inbox' },
    { dir: 'archived_threads', category: 'archived' },
    { dir: 'filtered_threads', category: 'filtered' },
    { dir: 'e2ee_cutover', category: 'e2ee' },
  ]

  for (const { dir: catDir, category } of cats) {
    const catPath = path.join(msgBase, catDir)
    if (!fs.existsSync(catPath)) continue
    const threadDirs = listDirs(catPath)
    for (const threadPath of threadDirs) {
      // Read all message_N.json files
      const msgFiles = fs.readdirSync(threadPath).filter(f => f.match(/^message_\d+\.json$/)).sort((a, b) => parseInt(a.match(/\d+/)?.[0] ?? 0) - parseInt(b.match(/\d+/)?.[0] ?? 0))
      if (msgFiles.length === 0) continue

      const allData = msgFiles.map(f => {
        const data = readJson(path.join(threadPath, f))
        return format === '2022' ? fixDeep(data) : data
      }).filter(Boolean)

      const first = allData[0]
      const participants = (first.participants ?? []).map(p => p.name ?? '').filter(Boolean)
      const title = first.title || participants.filter(n => n !== ME).join(', ') || 'Unknown'
      const isGroup = participants.length > 2

      const messages = []
      for (const rawData of allData) {
        const data = fixDeep(rawData)
        for (const msg of data.messages ?? []) {
          const photos = (msg.photos ?? []).map(p => ({ uri: `${webBase}/${p.uri}`, creationTimestamp: p.creation_timestamp }))
          messages.push({
            senderName: msg.sender_name ?? '',
            timestampMs: msg.timestamp_ms ?? 0,
            content: msg.content,
            photos: photos.length ? photos : undefined,
            isUnsent: msg.is_unsent ?? false,
            type: msg.type ?? 'Generic',
            reactions: (msg.reactions ?? []).map(r => ({ reaction: r.reaction, actor: r.actor })) || undefined,
          })
        }
      }
      messages.sort((a, b) => a.timestampMs - b.timestampMs)

      threads.push({
        id: `${source}:thread:${path.basename(threadPath)}`,
        title,
        participants,
        messages,
        category,
        isGroupThread: isGroup,
        source,
      })
    }
  }

  // Sort by last message
  return threads.sort((a, b) => {
    const la = a.messages[a.messages.length - 1]?.timestampMs ?? 0
    const lb = b.messages[b.messages.length - 1]?.timestampMs ?? 0
    return lb - la
  })
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function processExport(exportRoot, source) {
  const format = detectFormat(exportRoot)
  if (!format) {
    console.error(`  ✗ Could not detect format for: ${exportRoot}`)
    return null
  }
  console.log(`  Format: ${format}`)

  const webBase = `/exports/${source}`
  const tick = label => { process.stdout.write(`  → ${label}... `); return Date.now() }
  const tock = t => console.log(`done (${Date.now() - t}ms)`)

  let t = tick('profile'); const profile = parseProfile(exportRoot, format, source); tock(t)
  t = tick('posts');   const posts = parsePosts(exportRoot, format, source, webBase); console.log(`done (${posts.length} posts)`)
  t = tick('comments'); const comments = parseComments(exportRoot, format, source); console.log(`done (${comments.length} comments)`)
  t = tick('reactions'); const reactions = parseReactions(exportRoot, format, source); console.log(`done (${reactions.length} reactions)`)
  t = tick('photos');  const albums = parsePhotos(exportRoot, format, source, webBase); console.log(`done (${albums.length} albums, ${albums.reduce((s,a) => s+a.photos.length,0)} photos)`)
  t = tick('friends'); const friends = parseFriends(exportRoot, format, source); console.log(`done (${friends.length} friends)`)
  t = tick('events');  const events = parseEvents(exportRoot, format, source); console.log(`done (${events.length} events)`)
  t = tick('page likes'); const pageLikes = parsePageLikes(exportRoot, format, source); console.log(`done (${pageLikes.length})`)
  t = tick('messages (may take a moment)'); const threads = parseMessages(exportRoot, format, source, webBase, profile?.name ?? ''); console.log(`done (${threads.length} threads)`)

  return { source, format, profile, posts, comments, reactions, albums, threads, friends, events, pageLikes }
}

// ─── Setup directories and symlinks ───────────────────────────────────────────

fs.mkdirSync(EXPORTS_DIR, { recursive: true })

const sources = ['export2022', 'export2026']
const exportData = []

for (let i = 0; i < args.length; i++) {
  const exportRoot = path.resolve(args[i])
  const source = sources[i]
  console.log(`\n📦 Processing ${source}: ${exportRoot}`)

  if (!fs.existsSync(exportRoot)) {
    console.error(`  ✗ Directory not found: ${exportRoot}`)
    continue
  }

  // Create symlink so Vite can serve the photos
  const linkPath = path.join(EXPORTS_DIR, source)
  if (fs.existsSync(linkPath)) fs.rmSync(linkPath, { recursive: true, force: true })
  fs.symlinkSync(exportRoot, linkPath)
  console.log(`  ✓ Symlink created: public/exports/${source} → ${exportRoot}`)

  const data = processExport(exportRoot, source)
  if (data) exportData.push(data)
}

if (exportData.length === 0) {
  console.error('\n✗ No valid exports processed. Exiting.')
  process.exit(1)
}

// ─── Merge and write output ────────────────────────────────────────────────────

console.log('\n✍️  Writing vault-data.json...')

const allPosts = exportData.flatMap(e => e.posts).sort((a, b) => b.timestamp - a.timestamp)
const allComments = exportData.flatMap(e => e.comments).sort((a, b) => b.timestamp - a.timestamp)
const allReactions = exportData.flatMap(e => e.reactions).sort((a, b) => b.timestamp - a.timestamp)
const allAlbums = exportData.flatMap(e => e.albums)
const allThreads = exportData.flatMap(e => e.threads).sort((a, b) => {
  const la = a.messages[a.messages.length - 1]?.timestampMs ?? 0
  const lb = b.messages[b.messages.length - 1]?.timestampMs ?? 0
  return lb - la
})
const allFriends = exportData.flatMap(e => e.friends).sort((a, b) => b.timestamp - a.timestamp)
const allEvents = exportData.flatMap(e => e.events).sort((a, b) => b.startTimestamp - a.startTimestamp)
const allPageLikes = exportData.flatMap(e => e.pageLikes).sort((a, b) => b.timestamp - a.timestamp)
const profiles = exportData.flatMap(e => e.profile ? [e.profile] : [])

const vaultData = {
  generatedAt: new Date().toISOString(),
  exports: exportData.map(e => ({ source: e.source, format: e.format, postCount: e.posts.length, threadCount: e.threads.length })),
  profiles,
  allPosts,
  allComments,
  allReactions,
  allAlbums,
  allThreads,
  allFriends,
  allEvents,
  allPageLikes,
  allSearches: [],
  allMarketplace: [],
}

const json = JSON.stringify(vaultData)
fs.writeFileSync(OUTPUT_FILE, json)

const sizeMB = (Buffer.byteLength(json) / 1024 / 1024).toFixed(1)
console.log(`✓ vault-data.json written (${sizeMB} MB)`)
console.log('\n🎉 Done! Run: npm run dev — then open http://localhost:5173')
