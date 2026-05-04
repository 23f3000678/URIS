/**
 * Availability service — submit and retrieve weekly availability.
 */
import api from './api'

export interface BusyBlock {
  day: string
  reason: string
  severity: 'full' | 'partial'
}

export interface SubmitAvailabilityPayload {
  weekStatus: string
  busyBlocks: BusyBlock[]
  maxFreeBlockHours: number
  isExamWeek: boolean
  note?: string
}

export interface AvailabilityResult {
  availability: unknown
  TLI: number
  capacityScore: number
  capacityLabel: string
}

export async function submitAvailability(
  payload: SubmitAvailabilityPayload
): Promise<AvailabilityResult> {
  // Derive weekStart (Monday of current week) and weekEnd (7 days later)
  const now = new Date()
  const day = now.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  const weekStartDate = new Date(now)
  weekStartDate.setUTCDate(now.getUTCDate() + diff)
  weekStartDate.setUTCHours(0, 0, 0, 0)
  const weekEndDate = new Date(weekStartDate.getTime() + 7 * 24 * 60 * 60 * 1000)

  const toISO = (d: Date) => d.toISOString().split('T')[0]

  // Map frontend BusyBlock shape to backend shape:
  //   reason  → reason_code  (Joi requires reason_code)
  //   day     → short code   (backend expects MON/TUE/... not Monday/Tuesday/...)
  const DAY_MAP: Record<string, string> = {
    Monday: 'MON', Tuesday: 'TUE', Wednesday: 'WED',
    Thursday: 'THU', Friday: 'FRI', Saturday: 'SAT', Sunday: 'SUN',
  }

  const body = {
    weekStart:         toISO(weekStartDate),
    weekEnd:           toISO(weekEndDate),
    busyBlocks:        payload.busyBlocks.map(b => ({
      day:         DAY_MAP[b.day] ?? b.day,
      reason_code: b.reason,
      severity:    b.severity === 'full' ? 'high' : 'medium',
    })),
    maxFreeBlockHours: payload.maxFreeBlockHours,
    weekStatusToggle:  payload.weekStatus,
    isExamWeek:        payload.isExamWeek,
    ...(payload.note ? { notes: payload.note } : {}),
  }
  const res = await api.post<{ success: boolean; data: AvailabilityResult }>(
    '/availability/submit',
    body
  )
  return res.data.data
}
