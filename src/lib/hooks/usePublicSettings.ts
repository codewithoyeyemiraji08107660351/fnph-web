import { useQuery } from '@tanstack/react-query'
import { publicApi } from '@/lib/api/endpoints/publicInfo'
import type { PublicSettings } from '@/lib/api/types'

const LAST_KNOWN_KEY = 'fnph.publicSettings'

function lastKnown(): PublicSettings {
  try {
    return JSON.parse(localStorage.getItem(LAST_KNOWN_KEY) ?? '{}') as PublicSettings
  } catch {
    return {}
  }
}

/**
  Emergency number, fee and timings. The live value comes from the backend so
  the Central Administrator can change it. The last value seen is kept for
  display when the service is unreachable, with the build-time value as the
  final fallback.
*/
export function usePublicSettings() {
  const query = useQuery({
    queryKey: ['public-settings'],
    queryFn: async () => {
      const data = await publicApi.settings()
      localStorage.setItem(LAST_KNOWN_KEY, JSON.stringify(data))
      return data
    },
    staleTime: 5 * 60_000,
    retry: 1,
  })
  const settings: PublicSettings = { ...lastKnown(), ...(query.data ?? {}) }
  const num = (v: string | undefined, fallback: number) => {
    const n = Number(v)
    return Number.isFinite(n) && n > 0 ? n : fallback
  }
  return {
    emergencyNumber: settings.clinical_emergency_number || import.meta.env.VITE_FALLBACK_EMERGENCY_NUMBER || '08032722243',
    helpdeskEmail: settings.helpdesk_email || 'support@fnphkaduna.gov.ng',
    consultationFee: num(settings.consultation_fee_ngn, 10000),
    sessionMinutes: num(settings.session_minutes_fnph, 30),
    noShowMinutes: num(settings.no_show_cutoff_minutes, 15),
    cancellationHours: num(settings.cancellation_notice_hours, 24),
    prescriptionValidityDays: num(settings.prescription_validity_days, 7),
    inactivityMinutes: num(settings.session_inactivity_timeout_minutes, num(import.meta.env.VITE_FALLBACK_INACTIVITY_MINUTES, 30)),
    isLive: query.isSuccess,
  }
}
