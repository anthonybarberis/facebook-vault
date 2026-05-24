import { useState } from 'react'
import { useVault } from '../store/vault'
import { FBAlbum, FBPhoto } from '../types'
import PhotoImg from './PhotoImg'
import { formatDateShort } from '../utils/format'

function Lightbox({
  photo,
  album,
  rootHandle,
  onClose,
  onPrev,
  onNext,
}: {
  photo: FBPhoto
  album: FBAlbum
  rootHandle: FileSystemDirectoryHandle
  onClose: () => void
  onPrev: () => void
  onNext: () => void
}) {
  return (
    <div
      className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Nav prev */}
      <button
        onClick={e => { e.stopPropagation(); onPrev() }}
        className="absolute left-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white text-4xl p-2 z-10"
      >‹</button>

      {/* Main image */}
      <div
        className="max-w-5xl max-h-screen w-full flex flex-col items-center"
        onClick={e => e.stopPropagation()}
      >
        <PhotoImg
          rootHandle={rootHandle}
          uri={photo.uri}
          alt={photo.description ?? photo.title ?? ''}
          className="max-h-[75vh] max-w-full object-contain rounded-lg"
        />
        {/* Metadata */}
        <div className="mt-4 text-center text-white/80 max-w-lg px-4">
          {photo.description && (
            <p className="text-sm mb-2">{photo.description}</p>
          )}
          <div className="flex items-center justify-center gap-4 text-xs text-white/50">
            <span>{formatDateShort(photo.takenTimestamp ?? photo.creationTimestamp)}</span>
            {photo.cameraModel && <span>{photo.cameraModel}</span>}
            {photo.latitude && <span>📍 {photo.latitude.toFixed(4)}, {photo.longitude?.toFixed(4)}</span>}
            {photo.width && <span>{photo.width}×{photo.height}</span>}
          </div>
        </div>
      </div>

      {/* Nav next */}
      <button
        onClick={e => { e.stopPropagation(); onNext() }}
        className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white text-4xl p-2 z-10"
      >›</button>

      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/70 hover:text-white text-2xl"
      >✕</button>

      {/* Album name */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white/60 text-sm">
        {album.name}
      </div>
    </div>
  )
}

function AlbumGrid({
  album,
  rootHandle,
}: {
  album: FBAlbum
  rootHandle: FileSystemDirectoryHandle
}) {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)

  const openLightbox = (i: number) => setLightboxIdx(i)
  const closeLightbox = () => setLightboxIdx(null)
  const prevPhoto = () => setLightboxIdx(i => i !== null ? Math.max(0, i - 1) : null)
  const nextPhoto = () => setLightboxIdx(i => i !== null ? Math.min(album.photos.length - 1, i + 1) : null)

  return (
    <div>
      {lightboxIdx !== null && (
        <Lightbox
          photo={album.photos[lightboxIdx]}
          album={album}
          rootHandle={rootHandle}
          onClose={closeLightbox}
          onPrev={prevPhoto}
          onNext={nextPhoto}
        />
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-1">
        {album.photos.map((photo, i) => (
          <div
            key={photo.id}
            className="aspect-square cursor-pointer overflow-hidden rounded hover:opacity-90 transition-opacity"
            onClick={() => openLightbox(i)}
          >
            <PhotoImg
              rootHandle={rootHandle}
              uri={photo.uri}
              alt={photo.description ?? ''}
              className="w-full h-full object-cover"
            />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Albums() {
  const { state } = useVault()
  if (state.phase !== 'ready') return null
  const { vault } = state

  const [selectedAlbum, setSelectedAlbum] = useState<FBAlbum | null>(null)

  function rootFor(album: FBAlbum) {
    return vault.exports.find(e => e.source === album.source)?.rootHandle ?? vault.exports[0].rootHandle
  }

  const totalPhotos = vault.allAlbums.reduce((s, a) => s + a.photos.length, 0)

  if (selectedAlbum) {
    const root = rootFor(selectedAlbum)
    return (
      <div className="h-full flex flex-col">
        <div className="bg-white border-b border-stone-200 px-6 py-3 flex items-center gap-3">
          <button
            onClick={() => setSelectedAlbum(null)}
            className="text-stone-400 hover:text-stone-700 text-sm"
          >
            ← Albums
          </button>
          <h1 className="font-semibold text-stone-800">{selectedAlbum.name}</h1>
          <span className="text-xs text-stone-400">{selectedAlbum.photos.length} photos</span>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <AlbumGrid album={selectedAlbum} rootHandle={root} />
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className="bg-white border-b border-stone-200 px-6 py-3 flex items-center gap-3">
        <h1 className="font-semibold text-stone-800 text-sm">Albums</h1>
        <span className="text-xs text-stone-400">{vault.allAlbums.length} albums · {totalPhotos.toLocaleString()} photos</span>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 max-w-6xl mx-auto">
          {vault.allAlbums.map(album => {
            const root = rootFor(album)
            const cover = album.photos[0]
            const dateRange = album.photos.length > 0 ? (() => {
              const ts = album.photos.map(p => p.takenTimestamp ?? p.creationTimestamp).filter(Boolean).sort()
              if (ts.length === 0) return null
              const start = new Date(ts[0] * 1000).getFullYear()
              const end = new Date(ts[ts.length - 1] * 1000).getFullYear()
              return start === end ? `${start}` : `${start}–${end}`
            })() : null

            return (
              <div
                key={album.id}
                className="cursor-pointer group"
                onClick={() => setSelectedAlbum(album)}
              >
                <div className="aspect-square rounded-xl overflow-hidden bg-stone-200 mb-2 relative">
                  {cover ? (
                    <PhotoImg
                      rootHandle={root}
                      uri={cover.uri}
                      alt={album.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-stone-400 text-3xl">📷</div>
                  )}
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/50 to-transparent p-2">
                    <div className="text-white text-xs font-medium">{album.photos.length} photos</div>
                  </div>
                </div>
                <div className="text-sm font-medium text-stone-800 truncate">{album.name}</div>
                {dateRange && <div className="text-xs text-stone-400">{dateRange}</div>}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
