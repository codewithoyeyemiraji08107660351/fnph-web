import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'

import type { WorkRole } from '@/lib/api/types'

import { WorkDashboard } from '@/features/work/WorkDashboard'
import type { OpenConsultation } from '@/features/work/WorkHistory'

import { ConsultationDialog } from './dashboard/ConsultationDialog'

const ROLES: WorkRole[] = ['DOCTOR', 'NURSE', 'PHARMACIST', 'LABORATORY', 'HIM']

/** One team member's dashboard, as the Hub Coordinator sees it. */
export function StaffMember() {
  const { userId = '' } = useParams()
  const [params] = useSearchParams()
  const asked = params.get('role') as WorkRole | null
  const [open, setOpen] = useState<OpenConsultation | null>(null)

  return (
    <>
      <WorkDashboard
        key={userId}
        who={{ kind: 'staff', userPublicId: userId }}
        kicker="Team member"
        initialRole={asked && ROLES.includes(asked) ? asked : undefined}
        onOpen={setOpen}
        backLink={
          <Link to="/hub/staff" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold no-underline">
            <i aria-hidden className="bi bi-arrow-left" /> All team members
          </Link>
        }
      />
      {open && <ConsultationDialog consultation={open} onClose={() => setOpen(null)} />}
    </>
  )
}
