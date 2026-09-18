import { useQuery } from '@tanstack/react-query'
import { api, seg } from '@/lib/api/http'
import type { PatientIntake } from '@/lib/api/endpoints/patient'
import { ErrorState } from '@/components/ui/Page'
export function IntakeSummary({ appointmentId }: { appointmentId: string }) {
  const data=useQuery({queryKey:['appointment-intake',appointmentId],queryFn:()=>api.get<PatientIntake|null>(`/patient/intake/appointments/${seg(appointmentId)}`)})
  if(data.isLoading) return <p>Loading patient intake…</p>
  if(data.isError) return <ErrorState error={data.error} onRetry={()=>data.refetch()} />
  if(!data.data) return null
  return <section className="my-4 rounded-xl border border-line p-4"><h3 className="font-bold">Patient's consultation request</h3><p className="mt-2 whitespace-pre-wrap">{data.data.reason}</p>{data.data.context&&<p className="mt-2 whitespace-pre-wrap text-sm">{data.data.context}</p>}<p className="mt-2 text-sm">Preference: {data.data.mode==='VIDEO'?'Video first':'Audio fallback requested'}</p><p className="text-xs text-muted">Patient-reported information. Uploaded evidence is attached to this appointment.</p></section>
}
