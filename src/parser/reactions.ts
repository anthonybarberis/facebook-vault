import { FBReaction, ExportSource, ExportFormat } from '../types'
import { readJson, getDir, listFiles } from '../utils/fs'
import { fixMojibakeDeep } from '../utils/mojibake'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any

function extractReaction2026(item: Raw): string {
  // 2026 format: label_values array with {label: "Reaction", value: "Like"}
  if (Array.isArray(item?.label_values)) {
    const rxn = item.label_values.find((lv: Raw) => lv?.label === 'Reaction')
    if (rxn?.value) return rxn.value
  }
  return 'Like'
}

function extractTargetName2026(item: Raw): string | undefined {
  if (!Array.isArray(item?.label_values)) return undefined
  const owner = item.label_values.find((lv: Raw) => lv?.title === 'Owner')
  if (owner?.dict) {
    const nameEntry = owner.dict[0]?.dict?.find((d: Raw) => d.label === 'Name')
    return nameEntry?.value
  }
  return undefined
}

export async function parseReactions(
  root: FileSystemDirectoryHandle,
  format: ExportFormat,
  source: ExportSource
): Promise<FBReaction[]> {
  const reactions: FBReaction[] = []

  if (format === '2022') {
    const data = await readJson<Raw>(root, 'likes_and_reactions', 'posts_and_comments.json')
    const raw = fixMojibakeDeep(data) as Raw
    const list: Raw[] = raw?.reactions ?? []
    list.forEach((item: Raw, i: number) => {
      reactions.push({
        id: `${source}:reaction:${item.timestamp ?? i}:${i}`,
        timestamp: item.timestamp ?? 0,
        reaction: item.data?.[0]?.reaction?.reaction ?? 'Like',
        title: item.title,
        targetName: undefined,
        source,
      })
    })
  } else {
    // 2026: likes_and_reactions.json + likes_and_reactions_1.json, etc.
    const dir = await getDir(root, 'your_facebook_activity', 'comments_and_reactions')
    if (dir) {
      const files = await listFiles(dir)
      const rxnFiles = files
        .filter(f => f.name.match(/^likes_and_reactions/))
        .sort((a, b) => a.name.localeCompare(b.name))

      for (const fh of rxnFiles) {
        try {
          const file = await fh.getFile()
          const text = await file.text()
          const list: Raw[] = fixMojibakeDeep(JSON.parse(text)) as Raw[]
          if (Array.isArray(list)) {
            list.forEach((item: Raw, i: number) => {
              // Find URL if present
              const urlEntry = item.label_values?.find((lv: Raw) => lv?.label === 'URL')
              reactions.push({
                id: `${source}:reaction:${item.timestamp ?? i}:${reactions.length + i}`,
                timestamp: item.timestamp ?? 0,
                reaction: extractReaction2026(item),
                title: item.title,
                targetName: extractTargetName2026(item),
                url: urlEntry?.value,
                source,
              })
            })
          }
        } catch { /* skip */ }
      }
    }
  }

  return reactions.sort((a, b) => b.timestamp - a.timestamp)
}
