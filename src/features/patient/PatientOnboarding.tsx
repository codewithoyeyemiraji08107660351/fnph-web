import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { carePathApi } from '@/lib/api/endpoints/patient'
import { patientRecordsApi } from '@/lib/api/endpoints/records'
import type { TriageHistoryItem, TriageResult } from '@/lib/api/types'
import { ErrorState } from '@/components/ui/Page'
import { PatientConsent } from './PatientConsent'
import { PatientRecordBanner } from './PatientRecordBanner'
import { StopScreen, TriageStep } from './SafetyStep'

/** First-login patient setup: consent, triage, then the dashboard. */
export function PatientOnboarding() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const receipt = useQuery({ queryKey: ['consent-receipt'], queryFn: carePathApi.receipt })
  const triage = useQuery({ queryKey: ['triage-history'], queryFn: carePathApi.triageHistory })
  const patient = useQuery({ queryKey: ['my-record'], queryFn: patientRecordsApi.me })
  const [stopped, setStopped] = useState<TriageResult | null>(null)
  const [retaking, setRetaking] = useState(false)

  if (receipt.isLoading || triage.isLoading || patient.isLoading) return <p>Loading your first-time setup…</p>
  if (receipt.isError || triage.isError || patient.isError) {
    return <ErrorState error={receipt.error ?? triage.error ?? patient.error} onRetry={() => {
      void receipt.refetch(); void triage.refetch(); void patient.refetch()
    }} />
  }

  const banner = <PatientRecordBanner
    ehrNumber={patient.data!.ehrNumber}
    fullName={`${patient.data!.firstName} ${patient.data!.lastName}`.trim()}
    stage="First-time setup"
  />

  if (!receipt.data?.publicId) {
    return <>{banner}<PatientConsent onDone={() => { void receipt.refetch() }} /></>
  }
  // The latest answer decides. A stop is not permanent: the patient can answer
  // again once the questions no longer apply, and every answer is kept.
  const latest = triage.data?.[0]
  const shownStop: Pick<TriageResult, 'escalation' | 'stopReason'> | null =
    stopped ?? (latest && latest.outcome !== 'PROCEED' ? latest : null)
  const record = (result: TriageResult) =>
    qc.setQueryData<TriageHistoryItem[]>(['triage-history'], (old) => [
      { ...result, version: 'completed', submittedAt: new Date().toISOString() },
      ...(old ?? []),
    ])

  if (shownStop && !retaking) {
    return <>{banner}<StopScreen result={shownStop} onRetake={() => setRetaking(true)} /><Link className="button secondary mt-4" to="/portal">Go to my dashboard</Link></>
  }
  if (!latest || latest.outcome !== 'PROCEED' || retaking) {
    return <>{banner}<TriageStep
      retake={!!shownStop}
      onProceed={(result) => {
        record(result)
        navigate('/portal', { replace: true })
      }}
      onStop={(result) => {
        record(result)
        setStopped(result)
        setRetaking(false)
      }}
    /></>
  }
  return <Navigate to="/portal" replace />
}