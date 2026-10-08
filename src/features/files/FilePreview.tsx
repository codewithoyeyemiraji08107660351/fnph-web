import { useEffect, useState } from 'react'

import { saveBlob, type UploadRow } from '@/lib/api/endpoints/records'

import { Dialog } from '@/components/ui/Dialog'
import { Spinner } from '@/components/ui/Spinner'

import { rotateImage, useUploadImage } from './uploadimage'

/**
 * The image itself, with rotate and zoom. Phone photos of a paper chart often
 * arrive sideways, and a nurse transcribing from one needs it upright and
 * close.
 */
export function ImagePane({ row, tall = false }: { row: UploadRow; tall?: boolean }) {
  const image = useUploadImage(row.publicId)
  const [turn, setTurn] = useState(0)
  const [zoom, setZoom] = useState(false)
  const rotated = useRotated(image.status === 'ready' ? image.blob : null, turn)

  if (image.status === 'loading') return <div className="grid min-h-48 place-items-center rounded-[14px] border border-line bg-canvas"><Spinner label="Loading image" /></div>
  if (image.status === 'error') return <p className="rounded-[14px] border border-line bg-blush p-4 text-sm text-alarm-700">{image.message}</p>
  if (image.status === 'not-image') {
    return <p className="rounded-[14px] border border-line bg-canvas p-4 text-sm text-muted">This file is not an image that can be shown here. Download it to open it.</p>
  }

  const src = turn === 0 ? image.url : rotated
  return (
    <figure className="m-0">
      <div className={`overflow-auto rounded-[14px] border border-line bg-[#1d2a26] ${tall ? 'h-[min(60dvh,560px)]' : 'h-72'} ${zoom ? '' : 'grid place-items-center p-2'}`}>
        {src ? (
          <img
            src={src}
            alt={`${row.originalFileName}, sent by ${row.uploadedBy}`}
            className={zoom ? 'max-w-none' : 'max-h-full max-w-full object-contain'}
          />
        ) : (
          <Spinner label="Rotating" inverted />
        )}
      </div>
      <figcaption className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span className="min-w-0 truncate">{row.originalFileName}</span>
        <span className="flex gap-1">
          <button type="button" className="btn btn-quiet btn-sm" onClick={() => setTurn((t) => (t + 270) % 360)} aria-label="Rotate left">
            <i aria-hidden className="bi bi-arrow-counterclockwise" />
          </button>
          <button type="button" className="btn btn-quiet btn-sm" onClick={() => setTurn((t) => (t + 90) % 360)} aria-label="Rotate right">
            <i aria-hidden className="bi bi-arrow-clockwise" />
          </button>
          <button type="button" className="btn btn-quiet btn-sm" aria-pressed={zoom} onClick={() => setZoom((z) => !z)}>
            <i aria-hidden className={`bi ${zoom ? 'bi-zoom-out' : 'bi-zoom-in'}`} /> {zoom ? 'Fit' : 'Full size'}
          </button>
          <button type="button" className="btn btn-quiet btn-sm" onClick={() => saveBlob(image.blob, image.filename)}>
            <i aria-hidden className="bi bi-download" /> Save
          </button>
        </span>
      </figcaption>
    </figure>
  )
}

/** Object URL of the image turned by `turn` degrees; null while drawing or when not turned. */
function useRotated(blob: Blob | null, turn: number): string | null {
  const [rotated, setRotated] = useState<{ turn: number; url: string } | null>(null)
  useEffect(() => {
    if (!blob || turn === 0) return
    let cancelled = false
    let url: string | null = null
    rotateImage(blob, turn)
      .then((b) => {
        if (cancelled) return
        url = URL.createObjectURL(b)
        setRotated({ turn, url })
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [blob, turn])
  return rotated && rotated.turn === turn ? rotated.url : null
}

/** A small preview that opens the full image. */
export function FileThumbnail({ row, onOpen }: { row: UploadRow; onOpen: () => void }) {
  const image = useUploadImage(row.publicId)
  if (image.status !== 'ready') {
    return (
      <span aria-hidden className="grid size-14 shrink-0 place-items-center rounded-[10px] border border-line bg-canvas text-muted">
        {image.status === 'loading' ? <Spinner /> : <i className="bi bi-file-earmark" />}
      </span>
    )
  }
  return (
    <button
      type="button"
      onClick={onOpen}
      className="size-14 shrink-0 overflow-hidden rounded-[10px] border border-line bg-canvas focus-visible:outline-2 focus-visible:outline-accent"
      aria-label={`View ${row.originalFileName}`}
    >
      <img src={image.url} alt="" className="size-full object-cover" />
    </button>
  )
}

export function ImageViewerDialog({ row, onClose }: { row: UploadRow; onClose: () => void }) {
  return (
    <Dialog open onClose={onClose} size="lg" title={row.originalFileName} description={`Sent by ${row.uploadedBy}`}>
      <ImagePane row={row} tall />
    </Dialog>
  )
}
