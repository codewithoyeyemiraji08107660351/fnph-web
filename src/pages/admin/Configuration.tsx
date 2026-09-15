import { useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/lib/api/endpoints/admin'
import { toApiError } from '@/lib/api/http'
import type { ConfigurationItem } from '@/lib/api/types'
import { useAuth } from '@/lib/auth/AuthProvider'
import { formatDateTime, humanise, settingLabel, watInputToServer } from '@/lib/format'
import { ErrorState, PageHeader, Panel } from '@/components/ui/Page'
import { Badge } from '@/components/ui/Badge'
import { Dialog } from '@/components/ui/Dialog'
import { ReasonField, SelectField, TextField } from '@/components/ui/Field'
import { Alert } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'

function allowed(item: ConfigurationItem): string[] {
  if (item.valueType === 'BOOLEAN') return ['true', 'false']
  return item.allowedValues ? item.allowedValues.split(',').map((v) => v.trim()).filter(Boolean) : []
}

function validate(item: ConfigurationItem, value: string): string | null {
  const v = value.trim()
  if (!v) return 'A value is required.'
  if (item.valueType === 'INTEGER' || item.valueType === 'DECIMAL') {
    const n = Number(v)
    if (!Number.isFinite(n)) return 'Enter a number.'
    if (item.valueType === 'INTEGER' && !Number.isInteger(n)) return 'Enter a whole number.'
    if (item.minValue && n < Number(item.minValue)) return `The minimum is ${item.minValue}.`
    if (item.maxValue && n > Number(item.maxValue)) return `The maximum is ${item.maxValue}.`
  }
  const options = allowed(item)
  if (options.length && !options.includes(v)) return `Choose one of: ${options.join(', ')}.`
  return null
}

function EditDialog({ item, onClose }: { item: ConfigurationItem; onClose: () => void }) {
  const qc = useQueryClient()
  const toast = useToast()
  const [value, setValue] = useState(item.value === '********' ? '' : item.value)
  const [reason, setReason] = useState('')
  const [effective, setEffective] = useState('')
  const [error, setError] = useState<string | null>(null)
  const history = useQuery({ queryKey: ['admin', 'config-history', item.key], queryFn: () => adminApi.configuration.history(item.key) })
  const options = allowed(item)

  const save = useMutation({
    mutationFn: () => adminApi.configuration.update(item.key, { value: value.trim(), reason: reason.trim(), effectiveFrom: watInputToServer(effective) }),
    onSuccess: () => {
      toast(`${settingLabel(item.key)} updated.`)
      void qc.invalidateQueries({ queryKey: ['admin', 'configuration'] })
      void qc.invalidateQueries({ queryKey: ['public-settings'] })
      onClose()
    },
    onError: (err) => setError(toApiError(err).message),
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const problem = validate(item, value) ?? (reason.trim().length < 15 ? 'Give a reason of at least 15 characters.' : null)
    if (problem) return setError(problem)
    if (value.trim() === item.value) return setError('The new value is the same as the current one.')
    setError(null)
    save.mutate()
  }

  return (
    <Dialog
      open
      onClose={onClose}
      busy={save.isPending}
      size="lg"
      title={settingLabel(item.key)}
      description={item.description}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" type="submit" form="config-form" disabled={save.isPending}>
            {save.isPending ? <Spinner label="Saving" inverted /> : 'Save change'}
          </button>
        </>
      }
    >
      <form id="config-form" onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        {item.requiresGovernance && (
          <Alert tone="warning" title="Governance approval required" className="sm:col-span-2">
            This setting affects clinical or financial policy. Change it only with written FNPH approval, and quote the approval in the reason.
          </Alert>
        )}
        {error && <Alert tone="danger" className="sm:col-span-2">{error}</Alert>}
        <div>
          <p className="field-label">Current value</p>
          <p className="input bg-soft font-bold">{item.value}</p>
        </div>
        {options.length ? (
          <SelectField label="New value" value={value} onChange={(e) => setValue(e.target.value)}>
            <option value="">Choose</option>
            {options.map((o) => <option key={o} value={o}>{o}</option>)}
          </SelectField>
        ) : (
          <TextField
            label="New value"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            inputMode={item.valueType === 'INTEGER' || item.valueType === 'DECIMAL' ? 'decimal' : undefined}
            hint={item.minValue || item.maxValue ? `Allowed range ${item.minValue ?? 'any'} to ${item.maxValue ?? 'any'}` : undefined}
          />
        )}
        <TextField wrapperClassName="sm:col-span-2" label="Takes effect from (WAT)" type="datetime-local" value={effective} onChange={(e) => setEffective(e.target.value)} hint="Leave blank to apply immediately." />
        <div className="sm:col-span-2">
          <ReasonField value={reason} onChange={setReason} min={15} />
        </div>
      </form>
      <h3 className="mt-6 mb-2 text-sm font-extrabold">Change history</h3>
      {history.isLoading && <Spinner label="Loading history" />}
      {history.data?.length === 0 && <p className="text-sm text-muted">No recorded changes.</p>}
      <ol className="space-y-2">
        {history.data?.map((h, i) => (
          <li key={i} className="rounded-[12px] border border-line px-3 py-2.5 text-sm">
            <p>
              <span className="text-muted line-through">{h.previousValue ?? 'unset'}</span> <i aria-hidden className="bi bi-arrow-right mx-1 text-muted" /> <strong>{h.newValue}</strong>
            </p>
            <p className="text-xs text-muted">
              {h.changedBy}, {formatDateTime(h.changedAt)}. {h.reason}
            </p>
          </li>
        ))}
      </ol>
    </Dialog>
  )
}

export function Configuration() {
  const { can } = useAuth()
  const config = useQuery({ queryKey: ['admin', 'configuration'], queryFn: adminApi.configuration.list })
  const [editing, setEditing] = useState<ConfigurationItem | null>(null)
  const [filter, setFilter] = useState('')

  const grouped = useMemo(() => {
    const q = filter.trim().toLowerCase()
    const map = new Map<string, ConfigurationItem[]>()
    for (const item of config.data ?? []) {
      if (q && !`${item.key} ${item.description ?? ''} ${item.category}`.toLowerCase().includes(q)) continue
      const list = map.get(item.category) ?? []
      list.push(item)
      map.set(item.category, list)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [config.data, filter])

  return (
    <>
      <PageHeader
        kicker="System"
        title="Configuration"
        description="Fees, timings, validity periods and contact details. Every change needs a reason and is kept with its previous value."
      />
      <label className="relative mb-5 block max-w-md">
        <span className="sr-only">Filter settings</span>
        <i aria-hidden className="bi bi-funnel absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" />
        <input className="input pl-10" placeholder="Filter settings" value={filter} onChange={(e) => setFilter(e.target.value)} />
      </label>
      {config.isLoading && <Spinner label="Loading configuration" />}
      {config.isError && <ErrorState error={config.error} onRetry={() => config.refetch()} />}
      <div className="grid gap-5 xl:grid-cols-2">
        {grouped.map(([category, items]) => (
          <Panel key={category} title={humanise(category)} bodyClassName="">
            <ul className="divide-y divide-line">
              {items.map((item) => (
                <li key={item.key} className="flex items-start justify-between gap-4 px-5 py-3.5">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-bold">
                      {settingLabel(item.key)} {item.requiresGovernance && <Badge tone="gold">Governed</Badge>}
                    </p>
                    {item.description && <p className="mt-0.5 text-xs text-muted">{item.description}</p>}
                    <code className="mt-0.5 block text-[0.68rem] text-muted/80">{item.key}</code>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="max-w-[160px] truncate rounded-lg bg-soft px-2.5 py-1 font-mono text-sm font-bold" title={item.value}>{item.value}</span>
                    {can('config.update') && (
                      <button className="btn btn-quiet btn-sm" onClick={() => setEditing(item)} aria-label={`Change ${settingLabel(item.key)}`}>
                        <i aria-hidden className="bi bi-pencil" />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        ))}
      </div>
      {editing && <EditDialog item={editing} onClose={() => setEditing(null)} />}
    </>
  )
}
