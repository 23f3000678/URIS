import api from './api'

export interface ChangePasswordPayload {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

export interface ResetPasswordPayload {
  token: string
  newPassword: string
  confirmPassword: string
}

export async function changePassword(data: ChangePasswordPayload): Promise<{ emailSent: boolean }> {
  const res = await api.post('/auth/change-password', data)
  return res.data.data as { emailSent: boolean }
}

export async function forgotPassword(email: string): Promise<void> {
  await api.post('/auth/forgot-password', { email })
}

export async function resetPassword(data: ResetPasswordPayload): Promise<void> {
  await api.post('/auth/reset-password', data)
}
