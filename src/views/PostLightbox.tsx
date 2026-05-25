import { useCallback, useEffect } from 'react'
import { FBPostAttachment } from '../types'
import PhotoImg from './PhotoImg'

export default function PostLightbox({
  photos,
  index,
  rootHandle,
  onClose,
  onChange,
}: {
  photos: FBPostAttachment[]
  index: number
  rootHandle?: FileSystemDirectoryHandle
  onClose: () => void
  onChange: (i: number) => void
}) {
  const photo = photos[index]
  const total = photos.length

  const prev = useCallback(() => onChange((index - 1 + total) % total), [index, total, onChange])
  const next = useCallback(() => onChange((index + 1) % total), [index, total, onChange])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, prev, next])

  if (!photo?.uri) return null

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center" onClick={onClose}>
      {/* Prev */}
      {total > 1 && (
        <button
          onClick={e => { e.stopPropagation(); prev() }}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white text-4xl p-2 z-10"
        >‹</button>
      )}

      {/* Image */}
      <div className="max-w-5xl max-h-screen w-full flex flex-col items-center" onClick={e => e.stopPropagation()}>
        <PhotoImg
          rootHandle={rootHandle}
          uri={photo.uri}
          alt={photo.mediaTitle ?? photo.description ?? ''}
          className="max-h-[80vh] max-w-full object-contain rounded-lg"
        />
        <div className="mt-4 text-center text-white/80 max-w-lg px-4">
          {(photo.description || photo.mediaTitle) && (
            <p className="text-sm mb-2">{photo.description ?? photo.mediaTitle}</p>
          )}
          {total > 1 && (
            <p className="text-xs text-white/40">{index + 1} / {total}</p>
          )}
        </div>
      </div>

      {/* Next */}
      {total > 1 && (
        <button
          onClick={e => { e.stopPropagation(); next() }}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white text-4xl p-2 z-10"
        >›</button>
      )}

      {/* Close */}
      <button onClick={onClose} className="absolute top-4 right-4 text-white/70 hover:text-white text-2xl">✕</button>

      {/* Thumbnail strip */}
      {total > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 max-w-lg overflow-x-auto px-2">
          {photos.map((p, i) => p.uri && (
            <button
              key={i}
              onClick={e => { e.stopPropagation(); onChange(i) }}
              className={`flex-shrink-0 w-12 h-12 rounded overflow-hidden border-2 transition-colors ${
                i === index ? 'border-white' : 'border-transparent opacity-50 hover:opacity-80'
              }`}
            >
              <PhotoImg rootHandle={rootHandle} uri={p.uri} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
