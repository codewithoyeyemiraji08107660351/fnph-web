import { useState, type ReactNode } from 'react'
import { Dialog } from './Dialog'
import { ReasonField } from './Field'
import { Alert } from './Alert'
import { Spinner } from './Spinner'
import { toApiError } from '@/lib/api/http'

/** A confirmation that needs a written reason. The minimum mirrors the server's. */
export function ReasonDialog({
  title,
  description,
  label,
  confirmLabel,
  danger = false,
  min = 10,
  placeholder,
  onConfirm,
  onClose,
  children,
}: {
  title: string
  description?: ReactNode
  label?: string
  confirmLabel: string
  danger?: boolean
  min?: number
  placeholder?: string
  onConfirm: (reason: string) => Promise<unknown>
  onClose: () => void
  children?: ReactNode
}) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      await onConfirm(reason.trim())
    } catch (err) {
      setError(toApiError(err).message)
      setBusy(false)
    }
  }
  return (
    <Dialog
      open
      onClose={onClose}
      busy={busy}
      title={title}
      description={description}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} disabled={busy || reason.trim().length < min} onClick={submit}>
            {busy ? <Spinner label="Working" inverted /> : confirmLabel}
          </button>
        </>
      }
    >
      {children}
      {error && <Alert tone="danger" className="mb-4">{error}</Alert>}
      <ReasonField value={reason} onChange={setReason} min={min} label={label} placeholder={placeholder} />
    </Dialog>
  )
}

