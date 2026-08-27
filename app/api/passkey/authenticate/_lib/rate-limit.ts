const RATE_LIMIT = 10
const RATE_WINDOW_MS = 60 * 1000
const MAX_TRACKED_IPS = 10_000

const ipTimestamps = new Map<string, number[]>()

export function getClientIp(request: Request): string {
  const xff = request.headers.get('x-forwarded-for')
  return xff?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'
}

export function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const recent = (ipTimestamps.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS)
  if (recent.length >= RATE_LIMIT) return true
  recent.push(now)
  ipTimestamps.set(ip, recent)
  if (ipTimestamps.size > MAX_TRACKED_IPS) {
    const oldest = ipTimestamps.keys().next().value
    if (oldest !== undefined) ipTimestamps.delete(oldest)
  }
  return false
}
