import { useEffect, useState } from 'react'

import { uploadsApi, type UploadRow } from '@/lib/api/endpoints/records'
import { toApiError } from '@/lib/api/http'

const IMAGE_NAME = /\.(png|jpe?g|webp|gif)$/i

/** Worth trying to preview. The bytes decide whether it is actually shown. */
export function isImageUpload(row: Pick<UploadRow, 'contentType' | 'originalFileName'>) {
  return (row.contentType ?? '').toLowerCase().startsWith('image/') || IMAGE_NAME.test(row.originalFileName ?? '')
}

/**
 * The image type the bytes really are, from their first few bytes, or null.
 *
 * The content type on an upload is whatever the uploader's browser claimed.
 * Rendering is decided by the bytes instead, and only for raster formats an
 * img element can show: an SVG or HTML file renamed to .png is never
 * previewed, it stays a download.
 */
function sniffImage(head: Uint8Array): string | null {
  const at = (i: number, ...bytes: number[]) => bytes.every((b, k) => head[i + k] === b)
  if (at(0, 0x89, 0x50, 0x4e, 0x47)) return 'image/png'
  if (at(0, 0xff, 0xd8, 0xff)) return 'image/jpeg'
  if (at(0, 0x47, 0x49, 0x46, 0x38)) return 'image/gif'
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return 'image/webp'
  return null
}

type ImageState =
  | { status: 'loading' }
  | { status: 'ready'; url: string; blob: Blob; filename: string }
  | { status: 'not-image' }
  | { status: 'error'; message: string }

/**
 * Fetches an upload and returns an object URL for it when it is a real image.
 * The URL is revoked when the component using it goes away.
 */
export function useUploadImage(publicId: string): ImageState {
  const [state, setState] = useState<ImageState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    let url: string | null = null

    uploadsApi
      .download(publicId)
      .then(async ({ blob, filename }) => {
        const type = sniffImage(new Uint8Array(await blob.slice(0, 12).arrayBuffer()))
        if (cancelled) return
        if (!type) {
          setState({ status: 'not-image' })
          return
        }
        // Re-typed from the bytes, so the browser never sees the claimed type.
        const typed = new Blob([blob], { type })
        url = URL.createObjectURL(typed)
        setState({ status: 'ready', url, blob: typed, filename })
      })
      .catch((err) => {
        if (!cancelled) setState({ status: 'error', message: toApiError(err).message })
      })

    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [publicId])

  return state
}

/**
 * The image turned by a multiple of 90 degrees, drawn on a canvas.
 *
 * Done on the pixels rather than with a CSS transform, because a rotated
 * element keeps its unrotated layout box: a sideways photo then overflowed and
 * clipped its frame instead of fitting it.
 */
export async function rotateImage(blob: Blob, turn: number): Promise<Blob> {
  const bitmap = await createImageBitmap(blob)
  const sideways = turn % 180 !== 0
  const canvas = document.createElement('canvas')
  canvas.width = sideways ? bitmap.height : bitmap.width
  canvas.height = sideways ? bitmap.width : bitmap.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('This browser cannot rotate images')
  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate((turn * Math.PI) / 180)
  ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2)
  bitmap.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not rotate the image'))), 'image/jpeg', 0.92),
  )
}
