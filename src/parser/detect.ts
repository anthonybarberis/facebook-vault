import { ExportFormat } from '../types'
import { getDir } from '../utils/fs'

/**
 * Detect the format version of a Facebook export folder.
 * Returns null if the folder doesn't look like a Facebook export.
 */
export async function detectFormat(
  root: FileSystemDirectoryHandle
): Promise<ExportFormat | null> {
  // 2026 format: contains 'your_facebook_activity' directory
  const yfa = await getDir(root, 'your_facebook_activity')
  if (yfa) return '2026'

  // 2022 format: contains 'posts' and/or 'profile_information' at root
  const posts = await getDir(root, 'posts')
  if (posts) return '2022'

  const profile = await getDir(root, 'profile_information')
  if (profile) return '2022'

  const messages = await getDir(root, 'messages')
  if (messages) return '2022'

  return null
}
