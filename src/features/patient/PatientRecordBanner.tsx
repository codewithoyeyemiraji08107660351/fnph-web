interface PatientRecordBannerProps {
  ehrNumber: string
  fullName: string
  dateOfBirth?: string | null
  clinic?: string | null
  stage?: string
}

/** Keeps the matched patient visible while they move through enrolment and booking. */
export function PatientRecordBanner({ ehrNumber, fullName, dateOfBirth, clinic, stage }: PatientRecordBannerProps) {
  const initials = fullName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'PT'
  return (
    <section className="patient-record-banner mb-5 rounded-[18px] border border-line bg-white p-4 shadow-sm" aria-label="Current patient record">
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-mint font-display font-extrabold text-forest" aria-hidden>{initials}</span>
        <div className="min-w-0 flex-1">
          <span className="text-[11px] font-extrabold tracking-[.12em] text-muted uppercase">Patient record</span>
          <h2 className="truncate font-display text-lg font-extrabold text-ink">{fullName}</h2>
        </div>
        {stage && <span className="rounded-full bg-soft px-3 py-1 text-xs font-bold text-forest">{stage}</span>}
      </div>
      <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2 border-t border-line pt-3 text-sm">
        <div><dt className="text-xs text-muted">EHR number</dt><dd className="font-bold text-ink">{ehrNumber}</dd></div>
        {dateOfBirth && <div><dt className="text-xs text-muted">Date of birth</dt><dd className="font-bold text-ink">{dateOfBirth}</dd></div>}
        {clinic && <div><dt className="text-xs text-muted">Clinic</dt><dd className="font-bold text-ink">{clinic}</dd></div>}
      </dl>
    </section>
  )
}
