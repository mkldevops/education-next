import type { z } from 'zod'
import type { SchoolTool } from './school-tools'

export const read = { readOnlyHint: true, openWorldHint: false }
export const write = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
}
export const overwrite = { ...write, destructiveHint: true, idempotentHint: true }

/** Validate even direct catalog callers, strip unknown arguments, and adapt domain OK. */
export function tool<S extends z.ZodObject>(
  name: string,
  title: string,
  description: string,
  inputSchema: S,
  annotations: NonNullable<SchoolTool['annotations']>,
  run: (args: z.infer<S>) => Promise<unknown>
): SchoolTool {
  return {
    name,
    title,
    description,
    inputSchema,
    annotations,
    kind: annotations.readOnlyHint ? 'read' : 'write',
    run: async (input) => {
      const parsed = inputSchema.safeParse(input)
      if (!parsed.success) return 'validationError'
      const result = await run(parsed.data)
      return result === 'OK' ? { success: true } : result
    },
  }
}
