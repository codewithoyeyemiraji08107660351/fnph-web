import { useMemo } from 'react'

/**
  The Daily prebuilt room, embedded with the short-lived token the server
  minted for this one appointment. No Daily credential exists in the browser.
*/
export function ConsultFrame({ roomUrl, token, title }: { roomUrl: string; token: string; title: string }) {
  const src = useMemo(() => {
    try {
      const url = new URL(roomUrl)
      url.searchParams.set('t', token)
      return url.toString()
    } catch {
      return null
    }
  }, [roomUrl, token])
  if (!src) return <p className="rounded-[16px] bg-blush p-4 text-sm text-alarm-700">The room address from the server is not valid. Contact ICT support.</p>
  return (
    <div className="overflow-hidden rounded-[20px] border border-line bg-ink shadow-[var(--shadow-card)]">
      <iframe
        title={title}
        src={src}
        allow="camera; microphone; fullscreen; speaker-selection; display-capture; autoplay"
        className="block aspect-video min-h-[320px] w-full border-0 md:min-h-[440px]"
      />
    </div>
  )
}

