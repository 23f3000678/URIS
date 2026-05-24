import api from './api'

export interface ProfileData {
  id: string
  name: string
  email: string
  role: string
  status: string
  profilePictureUrl: string | null
  dateOfBirth: string | null
  joiningDate: string | null
  createdAt: string
  intern: {
    gdocUrl: string | null
    lastGdocReminderSentAt: string | null
  } | null
}

export interface ProfileUpdatePayload {
  name?: string
  profilePictureUrl?: string
  gdocUrl?: string
}

export async function getMyProfile(): Promise<ProfileData> {
  const res = await api.get('/profile/me')
  return res.data.data as ProfileData
}

export async function updateMyProfile(data: Partial<ProfileUpdatePayload>): Promise<ProfileData> {
  const res = await api.patch('/profile/me', data)
  return res.data.data as ProfileData
}

export async function uploadProfilePicture(file: File): Promise<{ profilePictureUrl: string }> {
  const formData = new FormData()
  formData.append('profilePicture', file)
  const res = await api.post('/profile/picture', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data.data as { profilePictureUrl: string }
}
