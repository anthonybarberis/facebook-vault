import { FBAlbum, FBPhoto, ExportSource, ExportFormat } from '../types'
import { getDir, listFiles, listDirs } from '../utils/fs'
import { fixMojibakeDeep } from '../utils/mojibake'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any

function extractPhotoMeta(raw: Raw, albumName: string, source: ExportSource, idx: number): FBPhoto {
  const meta = raw?.media_metadata?.photo_metadata ?? {}
  const exif = meta?.exif_data?.[0] ?? meta
  return {
    id: `${source}:photo:${raw.creation_timestamp ?? idx}:${idx}`,
    uri: raw.uri ?? '',
    albumName,
    creationTimestamp: raw.creation_timestamp ?? 0,
    takenTimestamp: exif.taken_timestamp,
    title: raw.title,
    description: raw.description,
    latitude: exif.latitude,
    longitude: exif.longitude,
    cameraMake: exif.camera_make,
    cameraModel: exif.camera_model,
    width: exif.original_width,
    height: exif.original_height,
    source,
  }
}

export async function parsePhotos(
  root: FileSystemDirectoryHandle,
  format: ExportFormat,
  source: ExportSource
): Promise<FBAlbum[]> {
  const albums: FBAlbum[] = []

  if (format === '2022') {
    // Album metadata in photos_and_videos/album/N.json
    const albumDir = await getDir(root, 'photos_and_videos', 'album')
    if (!albumDir) return albums

    const albumFiles = await listFiles(albumDir)
    const jsonFiles = albumFiles
      .filter(f => f.name.match(/^\d+\.json$/))
      .sort((a, b) => {
        const na = parseInt(a.name)
        const nb = parseInt(b.name)
        return na - nb
      })

    for (const fh of jsonFiles) {
      try {
        const file = await fh.getFile()
        const text = await file.text()
        const raw = fixMojibakeDeep(JSON.parse(text)) as Raw
        const name: string = raw.name ?? 'Untitled Album'
        const photos: FBPhoto[] = (raw.photos ?? []).map((p: Raw, i: number) =>
          extractPhotoMeta(p, name, source, i)
        )
        if (photos.length > 0 || name) {
          albums.push({ id: `${source}:album:${name}`, name, photos, source })
        }
      } catch { /* skip */ }
    }
  } else {
    // 2026: your_facebook_activity/posts/album/N.json
    const albumDir = await getDir(root, 'your_facebook_activity', 'posts', 'album')
    if (!albumDir) return albums

    const albumFiles = await listFiles(albumDir)
    const jsonFiles = albumFiles
      .filter(f => f.name.match(/^\d+\.json$/))
      .sort((a, b) => {
        const na = parseInt(a.name)
        const nb = parseInt(b.name)
        return na - nb
      })

    for (const fh of jsonFiles) {
      try {
        const file = await fh.getFile()
        const text = await file.text()
        const raw = JSON.parse(text) as Raw
        const name: string = raw.name ?? 'Untitled Album'
        const photos: FBPhoto[] = (raw.photos ?? []).map((p: Raw, i: number) =>
          extractPhotoMeta(p, name, source, i)
        )
        if (photos.length > 0 || name) {
          albums.push({ id: `${source}:album:${name}`, name, photos, source })
        }
      } catch { /* skip */ }
    }
  }

  return albums
}
