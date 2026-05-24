import { FBFriend, ExportSource, ExportFormat } from '../types'
import { readJson } from '../utils/fs'
import { fixMojibakeDeep } from '../utils/mojibake'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any

export async function parseFriends(
  root: FileSystemDirectoryHandle,
  format: ExportFormat,
  source: ExportSource
): Promise<FBFriend[]> {
  const friends: FBFriend[] = []
  let rawList: Raw[] = []

  if (format === '2022') {
    const data = await readJson<Raw>(root, 'friends', 'friends.json')
    const fixed = fixMojibakeDeep(data) as Raw
    rawList = fixed?.friends ?? []
  } else {
    const data = await readJson<Raw>(root, 'connections', 'friends', 'your_friends.json')
    rawList = (data as Raw)?.friends_v2 ?? []
  }

  rawList.forEach((r: Raw, i: number) => {
    if (!r.name) return
    friends.push({
      id: `${source}:friend:${i}`,
      name: r.name,
      timestamp: r.timestamp ?? 0,
      source,
    })
  })

  return friends.sort((a, b) => b.timestamp - a.timestamp)
}
