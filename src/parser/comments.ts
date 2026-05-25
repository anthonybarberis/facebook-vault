import { FBComment, ExportSource, ExportFormat } from '../types'
import { readJson } from '../utils/fs'
import { fixMojibakeDeep } from '../utils/mojibake'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any

function rawToComment(raw: Raw, source: ExportSource, idx: number): FBComment | null {
  const commentData = raw?.data?.find((d: Raw) => d.comment)?.comment
  if (!commentData && !raw?.data?.[0]?.comment) return null
  const c = commentData ?? raw.data[0].comment
  const text = c?.comment ?? c?.text
  if (!text) return null
  return {
    id: `${source}:comment:${raw.timestamp ?? idx}:${idx}`,
    timestamp: raw.timestamp ?? c.timestamp ?? 0,
    text,
    author: c.author ?? '',
    title: raw.title,
    source,
  }
}

export async function parseComments(
  root: FileSystemDirectoryHandle,
  format: ExportFormat,
  source: ExportSource
): Promise<FBComment[]> {
  let rawList: Raw[] = []

  if (format === '2022') {
    const data = await readJson<Raw>(root, 'comments', 'comments.json')
    const raw = fixMojibakeDeep(data) as Raw
    rawList = raw?.comments ?? []
  } else {
    const data = await readJson<Raw>(
      root,
      'your_facebook_activity', 'comments_and_reactions', 'comments.json'
    )
    const fixed = fixMojibakeDeep(data) as Raw
    rawList = fixed?.comments_v2 ?? (Array.isArray(fixed) ? fixed : [])
  }

  const comments: FBComment[] = []
  rawList.forEach((r: Raw, i: number) => {
    const c = rawToComment(r, source, i)
    if (c) comments.push(c)
  })

  // Also parse group comments for 2026
  if (format === '2026') {
    const groupData = await readJson<Raw>(
      root,
      'your_facebook_activity', 'groups', 'your_comments_in_groups.json'
    )
    const fixed = fixMojibakeDeep(groupData) as Raw
    const groupComments: Raw[] = fixed?.group_comments_v2 ?? []
    groupComments.forEach((r: Raw, i: number) => {
      const c = rawToComment(r, source, comments.length + i)
      if (c) comments.push(c)
    })
  }

  return comments.sort((a, b) => b.timestamp - a.timestamp)
}
