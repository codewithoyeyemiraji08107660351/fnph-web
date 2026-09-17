import { api } from '../http'
import type { NotificationItem } from '../types'

export const notificationsApi = {
  list: (unreadOnly = false) => api.list<NotificationItem>('/notifications', { params: { unreadOnly } }),
  unreadCount: () => api.get<{ unread: number }>('/notifications/unread-count'),
  markRead: (publicId: string) => api.post<void>(`/notifications/${encodeURIComponent(publicId)}/read`),
  markAllRead: () => api.post<{ marked: number }>('/notifications/read-all'),
}
