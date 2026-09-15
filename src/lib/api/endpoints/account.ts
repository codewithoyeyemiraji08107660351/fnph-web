import { api } from '../http'
import type { OwnProfile, SystemHealth } from '../types'

export interface ProfileUpdate {
  firstName?: string
  lastName?: string
  email?: string
  phoneNumber?: string
}

export const accountApi = {
  profile: () => api.get<OwnProfile>('/me/profile'),
  // The backend reads these as query parameters, not a JSON body.
  updateProfile: (changes: ProfileUpdate) => api.put<OwnProfile>('/me/profile', null, { params: changes }),
  health: () => api.get<SystemHealth>('/system/health'),
}
