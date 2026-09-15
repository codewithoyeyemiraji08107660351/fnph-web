import { useState } from 'react'
import { Link } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { adminApi } from '@/lib/api/endpoints/admin'
import type { UserStatus } from '@/lib/api/types'
import { useAuth } from '@/lib/auth/AuthProvider'
import { roleName } from '@/lib/auth/roles'
import { formatRelative, initials } from '@/lib/format'
import { EmptyState, ErrorState, PageHeader, Pager, Panel } from '@/components/ui/Page'
import { Badge, StatusBadge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { InviteUserDialog } from './InviteUserDialog'

const PAGE_SIZE = 25

export function Users() {
  const { can } = useAuth()
  const [term, setTerm] = useState('')
  const [appliedTerm, setAppliedTerm] = useState('')
  const [status, setStatus] = useState<UserStatus | ''>('')
  const [page, setPage] = useState(0)
  const [inviting, setInviting] = useState(false)

  const users = useQuery({
    queryKey: ['admin', 'users', appliedTerm, status, page],
    queryFn: () => adminApi.users.list({ term: appliedTerm, status, page, size: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  })

  return (
    <>
      <PageHeader
        kicker="Identity"
        title="Users"
        description="Staff and centre accounts. Deactivating a user ends their access but keeps every record they touched."
        actions={
          can('user.create') && (
            <button type="button" className="btn btn-primary" onClick={() => setInviting(true)}>
              <i aria-hidden className="bi bi-person-plus" /> Invite user
            </button>
          )
        }
      />
      <Panel bodyClassName="">
        <form
          className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault()
            setPage(0)
            setAppliedTerm(term.trim())
          }}
        >
          <label className="relative flex-1">
            <span className="sr-only">Search users</span>
            <i aria-hidden className="bi bi-search absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" />
            <input className="input pl-10" placeholder="Search by name, username or email" value={term} onChange={(e) => setTerm(e.target.value)} />
          </label>
          <label>
            <span className="sr-only">Status</span>
            <select
              className="input sm:w-52"
              value={status}
              onChange={(e) => {
                setPage(0)
                setStatus(e.target.value as UserStatus | '')
              }}
            >
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INVITED">Invitation pending</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="DEACTIVATED">Deactivated</option>
            </select>
          </label>
          <button className="btn btn-secondary" type="submit">Search</button>
        </form>

        {users.isLoading && <div className="p-5"><Spinner label="Loading users" /></div>}
        {users.isError && <ErrorState error={users.error} onRetry={() => users.refetch()} />}
        {users.data?.length === 0 && (
          <EmptyState icon="bi-people" title="No users match">
            {appliedTerm || status ? 'Try a different search or status.' : 'Invite the first member of staff to get started.'}
          </EmptyState>
        )}
        {!!users.data?.length && (
          <div className="overflow-x-auto">
            <table className="table-base min-w-[760px]">
              <thead>
                <tr>
                  <th scope="col">User</th>
                  <th scope="col">Role</th>
                  <th scope="col">Status</th>
                  <th scope="col">Security</th>
                  <th scope="col">Last sign in</th>
                  <th scope="col"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className={users.isPlaceholderData ? 'opacity-60' : ''}>
                {users.data.map((u) => (
                  <tr key={u.publicId} className="hover:bg-soft/60">
                    <td>
                      <div className="flex items-center gap-3">
                        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-bold text-accent">{initials(u.fullName)}</span>
                        <div className="min-w-0">
                          <p className="font-bold">{u.fullName}</p>
                          <p className="truncate text-xs text-muted">{u.username} {u.email ? `(${u.email})` : ''}</p>
                        </div>
                      </div>
                    </td>
                    <td className="text-sm">{u.roles.map(roleName).join(', ') || 'None'}</td>
                    <td><StatusBadge status={u.status} /></td>
                    <td>
                      <div className="flex flex-wrap gap-1.5">
                        {u.accountLocked && <Badge tone="red">Locked</Badge>}
                        {u.mfaEnabled ? <Badge tone="green">MFA on</Badge> : u.status === 'ACTIVE' ? <Badge tone="gold">No MFA</Badge> : null}
                      </div>
                    </td>
                    <td className="text-sm whitespace-nowrap text-muted">{u.lastLoginAt ? formatRelative(u.lastLoginAt) : 'Never'}</td>
                    <td className="text-right">
                      <Link to={`/admin/users/${encodeURIComponent(u.publicId)}`} className="btn btn-quiet btn-sm no-underline">
                        Manage
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!!users.data && (page > 0 || users.data.length === PAGE_SIZE) && (
          <Pager page={page} hasNext={users.data.length === PAGE_SIZE} onChange={setPage} />
        )}
      </Panel>
      <InviteUserDialog open={inviting} onClose={() => setInviting(false)} />
    </>
  )
}
