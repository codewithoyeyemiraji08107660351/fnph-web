import { useEffect, useId, useRef, type ReactNode } from 'react'

interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  size?: 'md' | 'lg'
  /** Blocks closing with Escape or the backdrop while a request is running. */
  busy?: boolean
}

export function Dialog({ open, onClose, title, description, children, footer, size = 'md', busy = false }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) el.showModal()
    if (!open && el.open) el.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault()
        if (!busy) onClose()
      }}
      onClick={(e) => {
        if (e.target === ref.current && !busy) onClose()
      }}
      className={`m-auto w-[calc(100%-1.5rem)] ${size === 'lg' ? 'max-w-3xl' : 'max-w-lg'} rounded-[22px] border border-line bg-white p-0 text-ink shadow-[var(--shadow-lift)] backdrop:bg-navy-900/45 backdrop:backdrop-blur-[2px]`}
    >
      {open && (
        <div className="flex max-h-[min(88dvh,860px)] flex-col">
          <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
            <div>
              <h2 id={titleId} className="text-lg font-extrabold">
                {title}
              </h2>
              {description && <div className="mt-1 text-sm text-muted">{description}</div>}
            </div>
            <button type="button" onClick={onClose} disabled={busy} className="btn btn-quiet btn-sm -mr-2 text-lg" aria-label="Close">
              <i aria-hidden className="bi bi-x-lg" />
            </button>
          </header>
          <div className="overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
          {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-line bg-canvas/60 px-5 py-3.5 sm:px-6">{footer}</footer>}
        </div>
      )}
    </dialog>
  )
}
