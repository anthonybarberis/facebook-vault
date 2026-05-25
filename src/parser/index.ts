import { ParsedExport, ExportSource, ParseProgress, VaultData } from '../types'
import { detectFormat } from './detect'
import { parseProfile } from './profile'
import { parsePosts } from './posts'
import { parseComments } from './comments'
import { parseReactions } from './reactions'
import { parsePhotos } from './photos'
import { parseFriends } from './friends'
import { parseEvents, parsePageLikes } from './events'
import { parseMessages } from './messages'

export { detectFormat }

export async function parseExport(
  root: FileSystemDirectoryHandle,
  source: ExportSource,
  onProgress: (p: ParseProgress) => void
): Promise<ParsedExport | null> {
  const format = await detectFormat(root)
  if (!format) return null

  const step = (stage: string, current = 0, total = 1) =>
    onProgress({ stage, current, total })

  step('Detecting format…')
  const profile = await parseProfile(root, format, source).catch(() => undefined)

  step('Reading posts…')
  const posts = await parsePosts(root, format, source).catch(() => [])

  step('Reading comments…')
  const comments = await parseComments(root, format, source).catch(() => [])

  step('Reading reactions…')
  const reactions = await parseReactions(root, format, source).catch(() => [])

  step('Reading photos & albums…')
  const albums = await parsePhotos(root, format, source).catch(() => [])

  step('Reading friends…')
  const friends = await parseFriends(root, format, source).catch(() => [])

  step('Reading events…')
  const events = await parseEvents(root, format, source).catch(() => [])

  step('Reading page likes…')
  const pageLikes = await parsePageLikes(root, format, source).catch(() => [])

  step('Reading messages… (this may take a moment)')
  const { threads, marketplace } = await parseMessages(
    root, format, source, profile?.name ?? '',
    (stage, done, total) => onProgress({ stage: `Messages: ${stage} (${done}/${total})`, current: done, total })
  ).catch(() => ({ threads: [], marketplace: [] }))

  step('Done!', 1, 1)

  return {
    source,
    format,
    rootHandle: root,
    profile: profile ?? undefined,
    posts,
    comments,
    reactions,
    albums,
    threads,
    marketplaceConversations: marketplace,
    friends,
    events,
    pageLikes,
    searches: [], // can add later
  }
}

export function mergeExports(exports: ParsedExport[]): VaultData {
  const allPosts = [...exports.flatMap(e => e.posts)].sort((a, b) => b.timestamp - a.timestamp)
  const allComments = [...exports.flatMap(e => e.comments)].sort((a, b) => b.timestamp - a.timestamp)
  const allReactions = [...exports.flatMap(e => e.reactions)].sort((a, b) => b.timestamp - a.timestamp)
  const allAlbums = exports.flatMap(e => e.albums)
  const allThreads = [...exports.flatMap(e => e.threads)].sort((a, b) => {
    const latestA = a.messages[a.messages.length - 1]?.timestampMs ?? 0
    const latestB = b.messages[b.messages.length - 1]?.timestampMs ?? 0
    return latestB - latestA
  })
  const allMarketplace = exports.flatMap(e => e.marketplaceConversations)
  const allFriends = [...exports.flatMap(e => e.friends)].sort((a, b) => b.timestamp - a.timestamp)
  const allEvents = [...exports.flatMap(e => e.events)].sort((a, b) => b.startTimestamp - a.startTimestamp)
  const allPageLikes = [...exports.flatMap(e => e.pageLikes)].sort((a, b) => b.timestamp - a.timestamp)
  const allSearches = [...exports.flatMap(e => e.searches)].sort((a, b) => b.timestamp - a.timestamp)
  const profiles = exports.flatMap(e => e.profile ? [e.profile] : [])

  return {
    exports,
    allPosts,
    allComments,
    allReactions,
    allAlbums,
    allThreads,
    allMarketplace,
    allFriends,
    allEvents,
    allPageLikes,
    allSearches,
    profiles,
  }
}
