// ─── Source tagging ──────────────────────────────────────────────────────────
export type ExportSource = 'export2022' | 'export2026'
export type ExportFormat = '2022' | '2026'

// ─── Profile ─────────────────────────────────────────────────────────────────
export interface FBProfile {
  name: string
  emails: string[]
  birthday?: { year: number; month: number; day: number }
  currentCity?: string
  hometown?: string
  relationship?: { status: string; partner?: string }
  education?: Array<{ name: string; type: string; graduated: boolean }>
  work?: Array<{ employer: string; title?: string }>
  source: ExportSource
}

// ─── Posts ───────────────────────────────────────────────────────────────────
export interface FBPostAttachment {
  type: 'photo' | 'video' | 'link' | 'text' | 'info'
  // for photo/video
  uri?: string
  mediaTitle?: string
  description?: string
  // for links
  url?: string
  linkTitle?: string
  linkDescription?: string
  // for info (e.g. Spotify share metadata with no URL)
  lines?: string[]
}

export interface FBPost {
  id: string
  timestamp: number // Unix seconds
  text?: string
  title?: string
  attachments: FBPostAttachment[]
  source: ExportSource
}

// ─── Comments ────────────────────────────────────────────────────────────────
export interface FBComment {
  id: string
  timestamp: number
  text: string
  author: string
  title?: string // "Anthony commented on X's post."
  source: ExportSource
}

// ─── Reactions ───────────────────────────────────────────────────────────────
export interface FBReaction {
  id: string
  timestamp: number
  reaction: string // "Like", "Love", "Haha", "Wow", "Sad", "Angry"
  title?: string
  targetName?: string
  url?: string
  source: ExportSource
}

// ─── Photos & Albums ─────────────────────────────────────────────────────────
export interface FBPhoto {
  id: string
  uri: string // relative path from export root
  albumName: string
  creationTimestamp: number
  takenTimestamp?: number
  title?: string
  description?: string
  latitude?: number
  longitude?: number
  cameraMake?: string
  cameraModel?: string
  width?: number
  height?: number
  source: ExportSource
}

export interface FBAlbum {
  id: string
  name: string
  photos: FBPhoto[]
  source: ExportSource
}

// ─── Messages ────────────────────────────────────────────────────────────────
export interface FBMessagePhoto {
  uri: string
  creationTimestamp?: number
}

export interface FBMessageReaction {
  reaction: string
  actor: string
}

export interface FBMessage {
  senderName: string
  timestampMs: number
  content?: string
  photos?: FBMessagePhoto[]
  videos?: FBMessagePhoto[]
  gifs?: FBMessagePhoto[]
  files?: FBMessagePhoto[]
  sticker?: { uri: string }
  reactions?: FBMessageReaction[]
  isUnsent: boolean
  type: string
}

export type ThreadCategory = 'inbox' | 'archived' | 'filtered' | 'e2ee' | 'group'

export interface FBThread {
  id: string
  title: string
  participants: string[]
  messages: FBMessage[]
  category: ThreadCategory
  isGroupThread: boolean
  source: ExportSource
}

// ─── Friends ─────────────────────────────────────────────────────────────────
export interface FBFriend {
  id: string
  name: string
  timestamp: number // friendship date
  source: ExportSource
}

// ─── Events ──────────────────────────────────────────────────────────────────
export interface FBEvent {
  id: string
  name: string
  startTimestamp: number
  endTimestamp?: number
  description?: string
  place?: {
    name: string
    address?: string
    latitude?: number
    longitude?: number
  }
  rsvp?: string // "Going", "Interested", "Declined"
  role: 'created' | 'hosted' | 'invited' | 'responded'
  source: ExportSource
}

// ─── Page Likes ──────────────────────────────────────────────────────────────
export interface FBPageLike {
  id: string
  name: string
  timestamp: number
  source: ExportSource
}

// ─── Marketplace ─────────────────────────────────────────────────────────────
export interface FBMarketplaceConversation {
  id: string
  title: string
  participants: string[]
  messages: FBMessage[]
  role: 'buyer' | 'seller'
  source: ExportSource
}

// ─── Search History ──────────────────────────────────────────────────────────
export interface FBSearch {
  timestamp: number
  query: string
  source: ExportSource
}

// ─── Parsed export ───────────────────────────────────────────────────────────
export interface ParsedExport {
  source: ExportSource
  format: ExportFormat
  rootHandle: FileSystemDirectoryHandle
  profile?: FBProfile
  posts: FBPost[]
  comments: FBComment[]
  reactions: FBReaction[]
  albums: FBAlbum[]
  threads: FBThread[]
  marketplaceConversations: FBMarketplaceConversation[]
  friends: FBFriend[]
  events: FBEvent[]
  pageLikes: FBPageLike[]
  searches: FBSearch[]
}

// ─── Combined vault state ────────────────────────────────────────────────────
export interface VaultData {
  exports: ParsedExport[]
  // Merged across all exports, sorted newest-first
  allPosts: FBPost[]
  allComments: FBComment[]
  allReactions: FBReaction[]
  allAlbums: FBAlbum[]
  allThreads: FBThread[]
  allMarketplace: FBMarketplaceConversation[]
  allFriends: FBFriend[]
  allEvents: FBEvent[]
  allPageLikes: FBPageLike[]
  allSearches: FBSearch[]
  profiles: FBProfile[]
}

// ─── Loading progress ────────────────────────────────────────────────────────
export interface ParseProgress {
  stage: string
  current: number
  total: number
}
