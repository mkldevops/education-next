import { createRateLimiter } from '@/lib/rate-limit'

export { getClientIp } from '@/lib/rate-limit'

export const isRateLimited = createRateLimiter({ limit: 10, windowMs: 60 * 1000 })
