import { useState } from 'react'
import { uploadsApi, type FileCategory } from '@/lib/api/endpoints/records'
import { toApiError } from '@/lib/api/http'
import { humanise } from '@/lib/format'
import { Dialog } from '@/components/ui/Dialog'
import { SelectField, TextField } from '@/components/ui/Field'
import { Alert } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'

const MAX_MB = 10

export function UploadDialog({ title, referenceId, categories, onClose, onDone }: {
  title: string
  referenceId?: string
  categories: FileCategory[]
  onClose: () => void
  onDone: () => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [category, setCategory] = useState<FileCategory>(categories[0])
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async () => {
    if (!file) return setError('Choose a file.')
    if (file.size > MAX_MB * 1024 * 1024) return setError(`That file is larger than ${MAX_MB} MB.`)
    setBusy(true)
    setError(null)
    try {
      await uploadsApi.upload(file, category, description.trim() || undefined, referenceId)
      onDone()
    } catch (err) {
      setError(toApiError(err).message)
      setBusy(false)
    }
  }
  return (
    <Dialog open onClose={onClose} busy={busy} title={title} description="PDF or a clear photo. Files are checked before anyone opens them."
      footer={<><button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button><button type="button" className="btn btn-primary" disabled={busy || !file} onClick={submit}>{busy ? <Spinner label="Uploading" inverted /> : 'Upload'}</button></>}>
      {error && <Alert tone="danger" className="mb-4">{error}</Alert>}
      <label className="block">
        <span className="field-label">File</span>
        <input type="file" accept="application/pdf,image/jpeg,image/png" className="input py-2" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </label>
      {categories.length > 1 && (
        <SelectField wrapperClassName="mt-4" label="What is it?" value={category} onChange={(e) => setCategory(e.target.value as FileCategory)}>
          {categories.map((c) => <option key={c} value={c}>{humanise(c)}</option>)}
        </SelectField>
      )}
      <TextField wrapperClassName="mt-4" label="Short description (optional)" maxLength={200} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Blood test from last week" />
    </Dialog>
  )
}
