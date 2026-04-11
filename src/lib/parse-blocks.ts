import { z } from 'zod'
import type { Block } from '@/use-cases/pages/schemas'
import { blockSchema } from '@/use-cases/pages/schemas'

export function parseBlocks(raw: unknown): Block[] {
  const result = z.array(blockSchema).safeParse(raw)
  return result.success ? result.data : []
}
