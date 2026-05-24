/**
 * File System Access API helpers.
 * All functions return null on failure rather than throwing, so callers can
 * gracefully handle missing files/directories.
 */

export async function getDir(
  root: FileSystemDirectoryHandle,
  ...parts: string[]
): Promise<FileSystemDirectoryHandle | null> {
  let current: FileSystemDirectoryHandle = root
  for (const part of parts) {
    try {
      current = await current.getDirectoryHandle(part)
    } catch {
      return null
    }
  }
  return current
}

export async function getFile(
  root: FileSystemDirectoryHandle,
  ...parts: string[]
): Promise<FileSystemFileHandle | null> {
  const dirParts = parts.slice(0, -1)
  const fileName = parts[parts.length - 1]
  let dir: FileSystemDirectoryHandle = root
  if (dirParts.length > 0) {
    const d = await getDir(root, ...dirParts)
    if (!d) return null
    dir = d
  }
  try {
    return await dir.getFileHandle(fileName)
  } catch {
    return null
  }
}

/** Resolve a URI string like "photos_and_videos/Album/file.jpg" to a file handle. */
export async function resolveUri(
  root: FileSystemDirectoryHandle,
  uri: string
): Promise<FileSystemFileHandle | null> {
  const parts = uri.split('/')
  return getFile(root, ...parts)
}

/** Read and parse a JSON file, returning null if missing or invalid. */
export async function readJson<T>(
  root: FileSystemDirectoryHandle,
  ...pathParts: string[]
): Promise<T | null> {
  const handle = await getFile(root, ...pathParts)
  if (!handle) return null
  try {
    const file = await handle.getFile()
    const text = await file.text()
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

/** List all entries (files and directories) in a directory. */
export async function listEntries(
  dir: FileSystemDirectoryHandle
): Promise<FileSystemHandle[]> {
  const entries: FileSystemHandle[] = []
  // @ts-expect-error FileSystemDirectoryHandle is async iterable in modern browsers
  for await (const entry of dir.values()) {
    entries.push(entry as FileSystemHandle)
  }
  return entries
}

/** List all subdirectories in a directory. */
export async function listDirs(
  dir: FileSystemDirectoryHandle
): Promise<FileSystemDirectoryHandle[]> {
  const entries = await listEntries(dir)
  return entries.filter(
    (e): e is FileSystemDirectoryHandle => e.kind === 'directory'
  )
}

/** List all files in a directory. */
export async function listFiles(
  dir: FileSystemDirectoryHandle
): Promise<FileSystemFileHandle[]> {
  const entries = await listEntries(dir)
  return entries.filter(
    (e): e is FileSystemFileHandle => e.kind === 'file'
  )
}

/** Read all message_N.json files from a thread directory, merged and sorted. */
export async function readAllMessageFiles<T>(
  threadDir: FileSystemDirectoryHandle
): Promise<T[]> {
  const files = await listFiles(threadDir)
  const msgFiles = files
    .filter(f => f.name.match(/^message_\d+\.json$/))
    .sort((a, b) => {
      const na = parseInt(a.name.match(/\d+/)?.[0] ?? '0')
      const nb = parseInt(b.name.match(/\d+/)?.[0] ?? '0')
      return na - nb
    })

  const results: T[] = []
  for (const fh of msgFiles) {
    try {
      const file = await fh.getFile()
      const text = await file.text()
      results.push(JSON.parse(text) as T)
    } catch {
      // skip bad files
    }
  }
  return results
}

/** Create an object URL for a file handle (caller must revoke). */
export async function createObjectUrl(handle: FileSystemFileHandle): Promise<string | null> {
  try {
    const file = await handle.getFile()
    return URL.createObjectURL(file)
  } catch {
    return null
  }
}
