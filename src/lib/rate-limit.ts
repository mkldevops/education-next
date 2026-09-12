type RateLimiterOptions = { limit: number; windowMs: number; maxTrackedKeys?: number }

const DEFAULT_MAX_TRACKED_KEYS = 10_000

export function getClientIp(request: Request): string {
  const xff = request.headers.get('x-forwarded-for')
  return xff?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'
}

/**
 * Fenêtre glissante en mémoire. Le déploiement est un `next start` long-vivant : le
 * compteur survit aux requêtes. Il ne survit pas à une mise à l'échelle horizontale —
 * n étages en parallèle laissent passer n fois le budget.
 */
export function createRateLimiter({
  limit,
  windowMs,
  maxTrackedKeys = DEFAULT_MAX_TRACKED_KEYS,
}: RateLimiterOptions) {
  const timestamps = new Map<string, number[]>()

  return function isRateLimited(key: string): boolean {
    const now = Date.now()
    const recent = (timestamps.get(key) ?? []).filter((t) => now - t < windowMs)
    if (recent.length >= limit) return true

    recent.push(now)
    timestamps.set(key, recent)
    if (timestamps.size > maxTrackedKeys) {
      const oldest = timestamps.keys().next().value
      if (oldest !== undefined) timestamps.delete(oldest)
    }
    return false
  }
}
