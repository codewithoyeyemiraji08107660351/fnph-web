import { useId, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'

interface FieldShellProps {
  label: string
  hint?: ReactNode
  error?: string
  id: string
  children: ReactNode
  className?: string
}

function FieldShell({ label, hint, error, id, children, className = '' }: FieldShellProps) {
  return (
    <div className={className}>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      {children}
      {error ? (
        <span id={`${id}-error`} className="field-error">
          {error}
        </span>
      ) : hint ? (
        <span id={`${id}-hint`} className="field-hint">
          {hint}
        </span>
      ) : null}
    </div>
  )
}

type Base = { label: string; hint?: ReactNode; error?: string; wrapperClassName?: string }

export function TextField({ label, hint, error, wrapperClassName, id, ...rest }: Base & InputHTMLAttributes<HTMLInputElement>) {
  const auto = useId()
  const fieldId = id ?? auto
  return (
    <FieldShell label={label} hint={hint} error={error} id={fieldId} className={wrapperClassName}>
      <input
        id={fieldId}
        className="input"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
        {...rest}
      />
    </FieldShell>
  )
}

export function PasswordField({ label, hint, error, wrapperClassName, id, ...rest }: Base & InputHTMLAttributes<HTMLInputElement>) {
  const auto = useId()
  const fieldId = id ?? auto
  const [visible, setVisible] = useState(false)
  return (
    <FieldShell label={label} hint={hint} error={error} id={fieldId} className={wrapperClassName}>
      <div className="relative">
        <input
          id={fieldId}
          type={visible ? 'text' : 'password'}
          className="input pr-12"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
          {...rest}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-[12px] text-muted hover:text-accent"
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
        >
          <i aria-hidden className={`bi ${visible ? 'bi-eye-slash' : 'bi-eye'}`} />
        </button>
      </div>
    </FieldShell>
  )
}

export function SelectField({ label, hint, error, wrapperClassName, id, children, ...rest }: Base & SelectHTMLAttributes<HTMLSelectElement>) {
  const auto = useId()
  const fieldId = id ?? auto
  return (
    <FieldShell label={label} hint={hint} error={error} id={fieldId} className={wrapperClassName}>
      <select id={fieldId} className="input appearance-auto" aria-invalid={error ? true : undefined} {...rest}>
        {children}
      </select>
    </FieldShell>
  )
}

export function TextAreaField({ label, hint, error, wrapperClassName, id, ...rest }: Base & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const auto = useId()
  const fieldId = id ?? auto
  return (
    <FieldShell label={label} hint={hint} error={error} id={fieldId} className={wrapperClassName}>
      <textarea
        id={fieldId}
        className="input min-h-24 resize-y"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
        {...rest}
      />
    </FieldShell>
  )
}

/** Every administrative change on this system carries a reason that lands in the audit log. */
export function ReasonField({ value, onChange, min, error, label = 'Reason for this change', placeholder, hint }: {
  value: string
  onChange: (v: string) => void
  min: number
  error?: string
  label?: string
  placeholder?: string
  hint?: string
}) {
  const remaining = Math.max(0, min - value.trim().length)
  return (
    <TextAreaField
      label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={3}
      maxLength={500}
      required
      error={error}
      placeholder={placeholder}
      hint={`${hint ?? 'Recorded in the audit log.'}${remaining > 0 ? ` At least ${remaining} more character${remaining === 1 ? '' : 's'}.` : ''}`}
    />
  )
}
