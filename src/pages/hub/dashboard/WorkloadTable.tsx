import type { HubStats } from '@/lib/api/types'

import { EmptyState, Panel } from '@/components/ui/Page'

import { ROLE_SHORT } from './dashboard'

/** Who carried the period's consultations, and who still has reviews open. */
export function WorkloadTable({ workload }: { workload: HubStats['workload'] }) {
  return (
    <Panel title="Staff workload" bodyClassName="">
      {workload.length === 0 ? (
        <EmptyState icon="bi-people" title="No one assigned in this period" />
      ) : (
        <div className="max-h-96 overflow-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Role</th>
                <th>Name</th>
                <th className="text-right">Consultations</th>
                <th className="text-right">Open reviews</th>
              </tr>
            </thead>
            <tbody>
              {workload.map((w) => (
                <tr key={`${w.role}-${w.name}`}>
                  <td className="text-sm text-muted">{ROLE_SHORT[w.role] ?? w.role}</td>
                  <td className="font-semibold">{w.name}</td>
                  <td className="text-right tabular-nums">{w.consultations}</td>
                  <td className={`text-right tabular-nums ${w.reviewsPending > 0 ? 'font-bold text-gold-700' : 'text-muted'}`}>
                    {w.role === 'PHARMACIST' || w.role === 'LABORATORY' ? w.reviewsPending : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}