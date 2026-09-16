import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { saveBlob, uploadsApi, type UploadRow } from '@/lib/api/endpoints/records'
import { toApiError } from '@/lib/api/http'
import { useAuth } from '@/lib/auth/AuthProvider'
import { formatDateTime, humanise } from '@/lib/format'
import { Badge } from '@/components/ui/Badge'
import { ReasonDialog } from '@/components/ui/ReasonDialog'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'

const size = (b: number) => (b > 1_048_576 ? `${(b / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`)

export function FileList({ rows, onChanged }: { rows: UploadRow[]; onChanged: () => void }) {
  const { can } = useAuth()
  const toast = useToast()
  const [busy, setBusy] = useState<string | null>(null)
  const [acting, setActing] = useState<{ row: UploadRow; kind: 'delete' | 'quarantine' } | null>(null)
  if (rows.length === 0) return <p className="text-sm text-muted">No files.</p>
  return (
    <>
      <ul className="space-y-2">
        {rows.map((u) => {
          const blocked = u.scanStatus === 'QUARANTINED' || u.scanStatus === 'REJECTED'
          return (
            <li key={u.publicId} className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] border border-line px-3 py-2 text-sm">
              <span className="min-w-0">
                <span className="block truncate font-bold">{u.originalFileName}</span>
                <span className="block text-xs text-muted">{humanise(u.category)}. {size(u.sizeBytes)}. {u.uploadedBy}, {formatDateTime(u.uploadedAt)}{u.description ? `. ${u.description}` : ''}</span>
              </span>
              <span className="flex flex-wrap items-center gap-1">
                {blocked ? <Badge tone="red">Held back</Badge> : u.scanStatus === 'CLEAN' ? <Badge tone="green">Checked</Badge> : <Badge tone="gold">{humanise(u.scanStatus)}</Badge>}
                {!blocked && (
                  <button type="button" className="btn btn-quiet btn-sm" disabled={busy === u.publicId} onClick={async () => {
                    setBusy(u.publicId)
                    try { const f = await uploadsApi.download(u.publicId); saveBlob(f.blob, f.filename) } catch (err) { toast(toApiError(err).message, 'error') } finally { setBusy(null) }
                  }}>{busy === u.publicId ? <Spinner /> : 'Download'}</button>
                )}
                {can('upload.quarantine') && !blocked && <button type="button" className="btn btn-quiet btn-sm" onClick={() => setActing({ row: u, kind: 'quarantine' })}>Quarantine</button>}
                {can('upload.delete') && <button type="button" className="btn btn-quiet btn-sm text-alarm" onClick={() => setActing({ row: u, kind: 'delete' })}>Delete</button>}
              </span>
            </li>
          )
        })}
      </ul>
      {acting && (
        <ReasonDialog
          title={acting.kind === 'delete' ? `Delete ${acting.row.originalFileName}?` : `Quarantine ${acting.row.originalFileName}?`}
          description={acting.kind === 'delete' ? 'The file is removed from use and its storage is queued for deletion. The record of it stays.' : 'Nobody can open the file until ICT releases it.'}
          label="Why" min={5} danger confirmLabel={acting.kind === 'delete' ? 'Delete' : 'Quarantine'}
          onClose={() => setActing(null)}
          onConfirm={async (reason) => {
            if (acting.kind === 'delete') await uploadsApi.remove(acting.row.publicId, reason)
            else await uploadsApi.quarantine(acting.row.publicId, reason)
            toast(acting.kind === 'delete' ? 'File deleted.' : 'File quarantined.')
            setActing(null)
            onChanged()
          }}
        />
      )}
    </>
  )
}

/** Files attached to an appointment or referral, for the staff preparing it. */
export function AttachedFiles({ referenceId }: { referenceId: string }) {
  const qc = useQueryClient()
  const files = useQuery({ queryKey: ['attached', referenceId], queryFn: () => uploadsApi.forReference(referenceId) })
  if (files.isLoading) return <Spinner label="Loading files" />
  if (files.isError) return <p className="text-sm text-alarm">{toApiError(files.error).message}</p>
  return <FileList rows={files.data ?? []} onChanged={() => void qc.invalidateQueries({ queryKey: ['attached', referenceId] })} />
}
