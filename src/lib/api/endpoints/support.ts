import { api, seg } from '../http'

export type TicketCategory = 'ACCESS_AND_SIGN_IN' | 'ENROLMENT' | 'BOOKING' | 'PAYMENT' | 'TECHNICAL_FAULT' | 'DOCUMENT_ACCESS' | 'CLINICAL_CONCERN' | 'OTHER'

/** helpdesk/api/TicketResponse */
export interface Ticket {
  publicId: string
  ticketNumber: string
  category: TicketCategory
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
  status: 'OPEN' | 'IN_PROGRESS' | 'AWAITING_REQUESTER' | 'ESCALATED' | 'RESOLVED' | 'CLOSED'
  subject: string
  escalatedToRole?: string
  firstResponseMinutes?: number
  resolutionSummary?: string
  createdAt: string
  messages: Array<{ author: string; body: string; internal: boolean; sentAt: string }>
}

export const supportApi = {
  raise: (body: { category: TicketCategory; subject: string; body: string; appointmentReference?: string; paymentReference?: string; documentNumber?: string }) =>
    api.post<Ticket>('/support/tickets', body),
  mine: () => api.list<Ticket>('/support/tickets/mine'),
  queue: (page = 0) => api.list<Ticket>('/support/queue', { params: { page, size: 50 } }),
  reply: (id: string, body: string, internal: boolean) => api.post<void>(`/support/tickets/${seg(id)}/reply`, null, { params: { body, internal } }),
  assign: (id: string, agentPublicId: string) => api.post<void>(`/support/tickets/${seg(id)}/assign`, null, { params: { agentPublicId } }),
  escalate: (id: string, toRole: string, reason: string) => api.post<void>(`/support/tickets/${seg(id)}/escalate`, null, { params: { toRole, reason } }),
  resolve: (id: string, summary: string) => api.post<void>(`/support/tickets/${seg(id)}/resolve`, null, { params: { summary } }),
  /** Tickets past their response target. */
  breaches: () => api.list<Ticket>('/support/breaches'),
}
