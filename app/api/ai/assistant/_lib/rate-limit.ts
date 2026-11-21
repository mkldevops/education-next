import { AI_ASSISTANT_LIMITS } from '@/domain/ai-assistant'
import { createRateLimiter } from '@/lib/rate-limit'

/** Un seul compteur par administrateur et par école pour les tours et les résumés. */
export const isAssistantUserRateLimited = createRateLimiter({
  limit: AI_ASSISTANT_LIMITS.requestsPerMinute,
  windowMs: 60 * 1000,
})
