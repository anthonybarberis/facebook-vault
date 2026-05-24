/**
 * Shared component that lazily resolves a photo URI to an object URL
 * via the File System Access API.
 */
import { useEffect, useState, useRef } from 'react'
import { resolveUri, createObjectUrl } from '../utils/fs'

interface Props {
  rootHandle?: FileSystemDirectoryHandle
  uri: string
  alt?: string
  className?: string
  onClick?: () => void
}

export default function PhotoImg({ rootHandle, uri, alt = '', className = '', onClick }: Props) {
  const [src, setSrc] = useState<string | null>(null)
  const [error, setError] = useState(false)
  const urlRef = useRef<string | null>(null)

  // If uri is already a web path (starts with /exports/ from preprocessing), use directly
  const isWebUri = uri.startsWith('/exports/') || uri.startsWith('http')

  useEffect(() => {
    if (isWebUri) {
      setSrc(uri)
      return
    }

    if (!rootHandle) { setError(true); return }

    let cancelled = false
    setSrc(null)
    setError(false)

    ;(async () => {
      try {
        const handle = await resolveUri(rootHandle, uri)
        if (!handle || cancelled) return
        const url = await createObjectUrl(handle)
        if (cancelled) {
          if (url) URL.revokeObjectURL(url)
          return
        }
        urlRef.current = url
        setSrc(url)
      } catch {
        if (!cancelled) setError(true)
      }
    })()

    return () => {
      cancelled = true
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current)
        urlRef.current = null
      }
    }
  }, [rootHandle, uri, isWebUri])

  if (error) {
    return (
      <div className={`bg-stone-200 flex items-center justify-center text-stone-400 text-xs ${className}`}>
        no image
      </div>
    )
  }

  if (!src) {
    return <div className={`bg-stone-100 animate-pulse ${className}`} />
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onClick={onClick}
      loading="lazy"
    />
  )
}
