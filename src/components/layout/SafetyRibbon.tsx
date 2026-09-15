import { usePublicSettings } from '@/lib/hooks/usePublicSettings'
import { formatPhone } from '@/lib/format'

/** The non-emergency notice required on every public and patient screen. */
export function SafetyRibbon({ compact = false }: { compact?: boolean }) {
  const { emergencyNumber } = usePublicSettings()
  return (
    <div className="bg-alarm-700 text-white">
      <div className="mx-auto flex max-w-[1320px] flex-wrap items-center justify-center gap-x-4 gap-y-1 px-4 py-2 text-center text-[0.8rem]">
        <p className="m-0">
          <strong className="font-bold">Telepsychiatry is not an emergency service.</strong>{' '}
          {!compact && <span className="opacity-90">If you may harm yourself or someone else, or need urgent help, do not continue online.</span>}
        </p>
        <a href={`tel:${emergencyNumber}`} className="inline-flex items-center gap-1.5 font-bold whitespace-nowrap text-white underline-offset-2 hover:underline">
          <i aria-hidden className="bi bi-telephone-fill text-xs" />
          Clinical emergency {formatPhone(emergencyNumber)}
        </a>
      </div>
    </div>
  )
}

export function StaffRibbon() {
  return (
    <div className="bg-navy-900 px-4 py-2 text-center text-[0.78rem] text-[#d8e7f1]">
      Authorised FNPH Kaduna personnel only. Activity is monitored and recorded.
    </div>
  )
}
