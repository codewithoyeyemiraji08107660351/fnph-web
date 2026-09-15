import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { notificationsApi } from '@/lib/api/endpoints/notifications'
import { formatRelative } from '@/lib/format'
import { Spinner } from '@/components/ui/Spinner'
import type { NotificationItem } from '@/lib/api/types'

export function NotificationMenu() {
  const [open, setOpen] = useState(false)
  const wrapper = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const qc = useQueryClient()

  const count = useQuery({
    queryKey: ['notifications', 'count'],
    queryFn: notificationsApi.unreadCount,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  })
  const list = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: () => notificationsApi.list(false),
    enabled: open,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['notifications'] })
  const markRead = useMutation({ mutationFn: notificationsApi.markRead, onSuccess: invalidate })
  const markAll = useMutation({ mutationFn: notificationsApi.markAllRead, onSuccess: invalidate })

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (wrapper.current && !wrapper.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const unread = count.data?.unread ?? 0

  const openItem = (n: NotificationItem) => {
    if (!n.read) markRead.mutate(n.publicId)
    // Only in-app paths are followed from a notification.
    if (n.actionUrl && n.actionUrl.startsWith('/') && !n.actionUrl.startsWith('//')) {
      setOpen(false)
      navigate(n.actionUrl)
    }
  }

  return (
    <div className="relative" ref={wrapper}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        className="relative grid size-11 place-items-center rounded-[12px] border border-line bg-white text-lg text-ink hover:border-accent"
      >
        <i aria-hidden className="bi bi-bell" />
        {unread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 grid min-w-5 place-items-center rounded-full bg-alarm px-1 text-[0.65rem] leading-5 font-bold text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="fixed inset-x-3 top-[72px] z-40 overflow-hidden rounded-[18px] border border-line bg-white shadow-[var(--shadow-lift)] sm:absolute sm:inset-x-auto sm:top-[calc(100%+8px)] sm:right-0 sm:w-[380px]">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="font-display font-bold">Notifications</p>
            <button type="button" className="btn btn-quiet btn-sm" disabled={!unread || markAll.isPending} onClick={() => markAll.mutate()}>
              Mark all read
            </button>
          </div>
          <div className="max-h-[60dvh] overflow-y-auto">
            {list.isLoading && <div className="p-5"><Spinner label="Loading notifications" /></div>}
            {list.isError && <p className="p-5 text-sm text-alarm">Notifications could not be loaded.</p>}
            {list.data?.length === 0 && <p className="p-6 text-center text-sm text-muted">Nothing new. Assignments and approvals will appear here.</p>}
            <ul className="divide-y divide-line">
              {list.data?.map((n) => (
                <li key={n.publicId}>
                  <button type="button" onClick={() => openItem(n)} className="flex w-full gap-3 px-4 py-3 text-left hover:bg-soft">
                    <span aria-hidden className={`mt-1.5 size-2 shrink-0 rounded-full ${n.read ? 'bg-transparent' : 'bg-accent'}`} />
                    <span className="min-w-0">
                      <span className={`block text-sm ${n.read ? 'text-muted' : 'font-bold text-ink'}`}>{n.subject}</span>
                      {n.body && <span className="mt-0.5 line-clamp-2 block text-xs text-muted">{n.body}</span>}
                      <span className="mt-1 block text-[0.7rem] text-muted">
                        {formatRelative(n.createdAt)}
                        {n.sharedWithRole && n.targetRole ? '. Shared with your team' : ''}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
