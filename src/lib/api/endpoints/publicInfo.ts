import { api } from '../http'
import type { DocumentVerification, PublicSettings } from '../types'

export const publicApi = {
  settings: () => api.get<PublicSettings>('/public/settings'),
  verifyDocument: (token: string) => api.get<DocumentVerification>(`/verify/${encodeURIComponent(token)}`),
}
