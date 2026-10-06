// Opt-in local clocks, formatted with the runtime's IANA time zone data.

const PLACES: Record<string, string> = {
  'Asia/Ho_Chi_Minh': 'VN',
  'Asia/Saigon': 'VN',
  'America/Los_Angeles': 'Pacific',
  'America/Denver': 'Mountain',
  'America/Chicago': 'Central',
  'America/New_York': 'Eastern',
  'Europe/London': 'London',
  'Asia/Singapore': 'Singapore',
  'Asia/Tokyo': 'Tokyo',
  'Australia/Sydney': 'Sydney'
}

export function placeOf(tz: string): string {
  return PLACES[tz] ?? (tz.split('/').pop() ?? '').replace(/_/g, ' ')
}

export function clockLabel(tz: string | null | undefined, nowMs: number): string | null {
  if (!tz) return null
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', hourCycle: 'h23', numberingSystem: 'latn' }).formatToParts(nowMs)
    const hour = Number(parts.find(p => p.type === 'hour')!.value) % 24
    const minute = Number(parts.find(p => p.type === 'minute')!.value)
    return `${placeOf(tz)} ${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`
  } catch {
    return null
  }
}
