import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { patientRecordsApi } from '@/lib/api/endpoints/records'
import { api, toApiError } from '@/lib/api/http'
import { ErrorState } from '@/components/ui/Page'
type Profile = { phone: string; email: string; location: string }
export function PatientProfile() {
  const record=useQuery({queryKey:['my-record'],queryFn:patientRecordsApi.me})
  const profile=useQuery({queryKey:['portal-profile'],queryFn:()=>api.get<Profile>('/patient/profile')})
  const [edited,setEdited]=useState<Profile|null>(null)
  const [message,setMessage]=useState('')
  const [error,setError]=useState('')
  const [busy,setBusy]=useState(false)
  if(record.isLoading || profile.isLoading) return <p>Loading your profile…</p>
  if(record.isError || profile.isError) return <ErrorState error={record.error??profile.error} onRetry={()=>{void record.refetch();void profile.refetch()}} />
  const form=edited??profile.data??{phone:'',email:'',location:''}
  return <><div className="screen-heading"><span className="eyebrow">My record and profile</span><h1>Verified hospital identity, editable contact details</h1><p>The offline FNPH EHR remains the clinical source of truth.</p></div><section className="card record-card"><dl><div><dt>EHR number</dt><dd>{record.data?.ehrNumber}</dd></div><div><dt>Name</dt><dd>{record.data?.firstName} {record.data?.lastName}</dd></div></dl></section><form className="card journey-form mt-5" onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');setMessage('');try{await api.put('/patient/profile',form);await profile.refetch();setMessage('Your portal contact details have been saved.')}catch(err){setError(toApiError(err).message)}finally{setBusy(false)}}}><h2>Portal contact details</h2>{(['phone','email','location'] as const).map(key=><label key={key}>{key==='phone'?'Phone number':key==='email'?'Email address':'Current location'}<input type={key==='email'?'email':key==='phone'?'tel':'text'} maxLength={key==='location'?300:key==='email'?254:30} value={form[key]??''} onChange={e=>setEdited({...form,[key]:e.target.value})} /></label>)}<p className="notice soft">These details are saved separately. Contact HIM to correct your hospital record or change your verified sign-in/recovery contact.</p>{error&&<p role="alert" className="form-error">{error}</p>}{message&&<p role="status">{message}</p>}<button className="button primary" disabled={busy}>{busy?'Saving…':'Save contact details'}</button></form></>
}
