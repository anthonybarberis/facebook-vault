import { FBPost, FBPostAttachment, ExportSource, ExportFormat } from '../types'
import { readJson, getDir, listFiles } from '../utils/fs'
import { fixMojibakeDeep } from '../utils/mojibake'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RawPost = any

function parseAttachments(rawAttachments: RawPost[]): FBPostAttachment[] {
  if (!Array.isArray(rawAttachments)) return []
  const out: FBPostAttachment[] = []
  for (const att of rawAttachments) {
    const data = att?.data ?? []
    for (const item of data) {
      if (item?.media) {
        const m = item.media
        const isVideo = m.uri?.match(/\.(mp4|mov|avi|mkv|webm)$/i)
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
      } else if (item?.text) {
        out.push({ type: 'text', mediaTitle: item.text })
      }
    }
  }
  return out
}

function rawToPost(raw: RawPost, source: ExportSource, idx: number): FBPost {
  const postText = raw.data?.find((d: RawPost) => d.post)?.post
  return {
    id: `${source}:post:${raw.timestamp ?? idx}:${idx}`,
    timestamp: raw.timestamp ?? 0,
    text: postText,
    title: raw.title,
    attachments: parseAttachments(raw.attachments ?? []),
    source,
  }
}

export async function parsePosts(
  root: FileSystemDirectoryHandle,
  format: ExportFormat,
  source: ExportSource
): Promise<FBPost[]> {
  const posts: FBPost[] = []

  if (format === '2022') {
    // posts/your_posts_1.json, your_posts_2.json, ...
    const postsDir = await getDir(root, 'posts')
    if (!postsDir) return posts
    const files = await listFiles(postsDir)
    const postFiles = files
      .filter(f => f.name.match(/^your_posts_\d+\.json$/))
      .sort((a, b) => a.name.localeCompare(b.name))

    for (const fh of postFiles) {
      try {
        const file = await fh.getFile()
        const text = await file.text()
        const raw = fixMojibakeDeep(JSON.parse(text)) as RawPost[]
        if (Array.isArray(raw)) {
          raw.forEach((r, i) => posts.push(rawToPost(r, source, posts.length + i)))
        }
      } catch { /* skip */ }
    }
  } else {
    // your_facebook_activity/posts/your_posts__check_ins__photos_and_videos_1.json, etc.
    const postsDir = await getDir(root, 'your_facebook_activity', 'posts')
    if (!postsDir) return posts
    const files = await listFiles(postsDir)
    const postFiles = files
      .filter(f => f.name.match(/your_posts.*\.json$/))
      .sort((a, b) => a.name.localeCompare(b.name))

    for (const fh of postFiles) {
      try {
        const file = await fh.getFile()
        const text = await file.text()
        const raw = JSON.parse(text) as RawPost[]
        if (Array.isArray(raw)) {
          raw.forEach((r, i) => posts.push(rawToPost(r, source, posts.length + i)))
        }
      } catch { /* skip */ }
    }
  }

  return posts.sort((a, b) => b.timestamp - a.timestamp)
}
