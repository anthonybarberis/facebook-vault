import { FBThread, FBMessage, FBMessagePhoto, FBMessageReaction, ThreadCategory, ExportSource, ExportFormat, FBMarketplaceConversation } from '../types'
import { getDir, listDirs, readAllMessageFiles } from '../utils/fs'
import { fixMojibakeDeep } from '../utils/mojibake'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any

function parseMessage(raw: Raw, format: ExportFormat): FBMessage {
  const photos: FBMessagePhoto[] = (raw.photos ?? []).map((p: Raw) => ({
    uri: p.uri,
    creationTimestamp: p.creation_timestamp,
  }))
  const videos: FBMessagePhoto[] = (raw.videos ?? []).map((v: Raw) => ({
    uri: v.uri,
    creationTimestamp: v.creation_timestamp,
  }))
  const gifs: FBMessagePhoto[] = (raw.gifs ?? []).map((g: Raw) => ({
    uri: g.uri,
  }))
  const files: FBMessagePhoto[] = (raw.files ?? []).map((f: Raw) => ({
    uri: f.uri,
  }))
  const reactions: FBMessageReaction[] = (raw.reactions ?? []).map((r: Raw) => ({
    reaction: r.reaction,
    actor: r.actor,
  }))

  return {
    senderName: raw.sender_name ?? '',
    timestampMs: raw.timestamp_ms ?? 0,
    content: raw.content,
    photos: photos.length > 0 ? photos : undefined,
    videos: videos.length > 0 ? videos : undefined,
    gifs: gifs.length > 0 ? gifs : undefined,
    files: files.length > 0 ? files : undefined,
    sticker: raw.sticker,
    reactions: reactions.length > 0 ? reactions : undefined,
    isUnsent: raw.is_unsent ?? false,
    type: raw.type ?? 'Generic',
  }
}

async function parseThreadDir(
  threadDir: FileSystemDirectoryHandle,
  category: ThreadCategory,
  source: ExportSource,
  format: ExportFormat,
  selfName: string
): Promise<FBThread | null> {
  const rawFiles = await readAllMessageFiles<Raw>(threadDir)
  if (rawFiles.length === 0) return null

  const first = format === '2022' ? fixMojibakeDeep(rawFiles[0]) as Raw : rawFiles[0]

  const participants: string[] = (first.participants ?? [])
    .map((p: Raw) => p.name ?? '')
    .filter(Boolean)

  const title: string = first.title || participants.filter(n => n !== selfName).join(', ') || 'Unknown'

  const isGroup = participants.length > 2

  const messages: FBMessage[] = []
  for (const raw of rawFiles) {
    const data = format === '2022' ? fixMojibakeDeep(raw) as Raw : raw
    for (const msg of data.messages ?? []) {
      messages.push(parseMessage(msg, format))
    }
  }

  // Sort messages chronologically (oldest first for display)
  messages.sort((a, b) => a.timestampMs - b.timestampMs)

  return {
    id: `${source}:thread:${threadDir.name}`,
    title,
    participants,
    messages,
    category,
    isGroupThread: isGroup,
    source,
  }
}

async function parseThreadsInDir(
  parentDir: FileSystemDirectoryHandle,
  category: ThreadCategory,
  source: ExportSource,
  format: ExportFormat,
  selfName: string,
  onProgress?: (done: number) => void
): Promise<{ threads: FBThread[]; marketplace: FBMarketplaceConversation[] }> {
  const threads: FBThread[] = []
  const marketplace: FBMarketplaceConversation[] = []

  const dirs = await listDirs(parentDir)
  let done = 0
  for (const threadDir of dirs) {
    const thread = await parseThreadDir(threadDir, category, source, format, selfName)
    if (thread) {
      // Detect marketplace threads by message content patterns
      const isMarketplace = thread.messages.some(m =>
        /\$\d+|how much|interested|sold|available|pickup|shipping/i.test(m.content ?? '')
      )

      if (isMarketplace && category === 'inbox') {
        // Classify as marketplace conversation
        const otherParticipants = thread.participants.filter(p => p !== selfName)
        const role: 'buyer' | 'seller' = otherParticipants.length > 0 ? 'buyer' : 'seller'
        marketplace.push({
          id: thread.id,
          title: thread.title,
          participants: otherParticipants,
          messages: thread.messages,
          role,
          source,
        })
      } else {
        threads.push(thread)
      }
    }
    done++
    onProgress?.(done)
  }

  return { threads, marketplace }
}

export async function parseMessages(
  root: FileSystemDirectoryHandle,
  format: ExportFormat,
  source: ExportSource,
  selfName: string,
  onProgress?: (stage: string, done: number, total: number) => void
): Promise<{ threads: FBThread[]; marketplace: FBMarketplaceConversation[] }> {
  const allThreads: FBThread[] = []
  const allMarketplace: FBMarketplaceConversation[] = []

  const msgBase = format === '2022'
    ? await getDir(root, 'messages')
    : await getDir(root, 'your_facebook_activity', 'messages')

  if (!msgBase) return { threads: [], marketplace: [] }

  const categories: Array<{ name: string; category: ThreadCategory }> = [
    { name: 'inbox', category: 'inbox' },
    { name: 'archived_threads', category: 'archived' },
    { name: 'filtered_threads', category: 'filtered' },
    { name: 'e2ee_cutover', category: 'e2ee' },
  ]

  for (const { name, category } of categories) {
    const dir = await getDir(msgBase, name)
    if (!dir) continue

    const threadDirs = await listDirs(dir)
    onProgress?.(name, 0, threadDirs.length)

    const { threads, marketplace } = await parseThreadsInDir(dir, category, source, format, selfName, (done) => {
      onProgress?.(name, done, threadDirs.length)
    })
    allThreads.push(...threads)
    allMarketplace.push(...marketplace)
  }

  return { threads: allThreads, marketplace: allMarketplace }
}
