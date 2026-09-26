import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

type ToolHandler = (args: unknown) => Promise<{
  content: Array<{ type: 'text'; text: string }>
  isError?: boolean
}>

const registered = new Map<string, { config: Record<string, unknown>; handler: ToolHandler }>()

class FakeMcpServer {
  registerTool(name: string, config: Record<string, unknown>, handler: ToolHandler) {
    registered.set(name, { config, handler })
  }
}

const mcpReadGateway = {
  describeSchool: vi.fn(),
  listLevels: vi.fn(),
  listPeriods: vi.fn(),
  listClassPeriods: vi.fn(),
  listPlans: vi.fn(),
  listTeachers: vi.fn(),
  listClassScheduleSlots: vi.fn(),
}

const previewEnrollFamily = vi.fn()
const commitEnrollFamily = vi.fn()
const previewRecordPayment = vi.fn()
const commitRecordPayment = vi.fn()
const previewUpdateEnrollment = vi.fn()
const commitUpdateEnrollment = vi.fn()
const createEventFromMcp = vi.fn()
const listClassScheduleSlotsFromMcp = vi.fn()
const createClassScheduleSlotFromMcp = vi.fn()
const updateClassScheduleSlotFromMcp = vi.fn()
const deleteClassScheduleSlotFromMcp = vi.fn()

vi.mock('@modelcontextprotocol/server', () => ({ McpServer: FakeMcpServer }))
vi.mock('@/gateways/mcp-read-gateway', () => ({ mcpReadGateway }))
vi.mock('@/use-cases/mcp/preview-enroll-family', () => ({ previewEnrollFamily }))
vi.mock('@/use-cases/mcp/commit-enroll-family', () => ({ commitEnrollFamily }))
vi.mock('@/use-cases/mcp/preview-record-payment', () => ({ previewRecordPayment }))
vi.mock('@/use-cases/mcp/commit-record-payment', () => ({ commitRecordPayment }))
vi.mock('@/use-cases/mcp/preview-update-enrollment', () => ({ previewUpdateEnrollment }))
vi.mock('@/use-cases/mcp/commit-update-enrollment', () => ({ commitUpdateEnrollment }))
vi.mock('@/use-cases/mcp/create-event', () => ({ createEventFromMcp }))
vi.mock('@/use-cases/mcp/class-schedule', () => ({
  listClassScheduleSlotsFromMcp,
  createClassScheduleSlotFromMcp,
  updateClassScheduleSlotFromMcp,
  deleteClassScheduleSlotFromMcp,
}))

const { buildMcpServer } = await import('./server')

const scope = {
  keyId: 'key-1',
  keyPrefix: 'edu_mcp_aaaa',
  owner: { kind: 'MCP_KEY' as const, keyId: 'key-1' },
  userId: 'user-1',
  schoolId: 'school-1',
  isSuperAdmin: false as const,
  paymentsEnabled: true,
}

const build = (overrides: Partial<typeof scope> = {}) => {
  registered.clear()
  buildMcpServer({ ...scope, ...overrides })
  return registered
}

const payload = (result: { content: Array<{ type: 'text'; text: string }> }) =>
  JSON.parse(result.content[0].text)

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  previewEnrollFamily.mockResolvedValue({ draftId: 'draft-1', blockers: [] })
  commitEnrollFamily.mockResolvedValue({ familyId: 'family-1' })
  previewRecordPayment.mockResolvedValue({ draftId: 'draft-2', blockers: [] })
  commitRecordPayment.mockResolvedValue({ familyId: 'family-1', paymentIds: [] })
})

describe('buildMcpServer', () => {
  it('publishes schedule tools alongside the existing reads and writes', () => {
    expect([...build().keys()]).toEqual([
      'describe_school',
      'list_levels',
      'list_periods',
      'list_class_periods',
      'list_class_schedule_slots',
      'create_class_schedule_slot',
      'update_class_schedule_slot',
      'delete_class_schedule_slot',
      'list_plans',
      'list_teachers',
      'preview_enroll_family',
      'commit_enroll_family',
      'create_event',
      'preview_record_payment',
      'commit_record_payment',
      'preview_update_enrollment',
      'commit_update_enrollment',
    ])
  })

  it('omits the five money tools when the school has turned payments off', () => {
    expect([...build({ paymentsEnabled: false }).keys()]).toEqual([
      'describe_school',
      'list_levels',
      'list_periods',
      'list_class_periods',
      'list_class_schedule_slots',
      'create_class_schedule_slot',
      'update_class_schedule_slot',
      'delete_class_schedule_slot',
      'list_teachers',
      'preview_enroll_family',
      'commit_enroll_family',
      'create_event',
    ])
  })

  it('declares previews as writers and commits as non-destructive and idempotent', () => {
    const tools = build()

    for (const name of [
      'preview_enroll_family',
      'preview_record_payment',
      'preview_update_enrollment',
    ]) {
      expect(tools.get(name)?.config.annotations).toMatchObject({
        readOnlyHint: false,
        idempotentHint: false,
      })
    }
    for (const name of [
      'commit_enroll_family',
      'commit_record_payment',
      'commit_update_enrollment',
    ]) {
      expect(tools.get(name)?.config.annotations).toMatchObject({
        destructiveHint: false,
        idempotentHint: true,
      })
    }
  })

  it('never lets a tool argument name a school; the key decides', async () => {
    const tools = build()

    for (const tool of tools.values()) {
      const shape = (tool.config.inputSchema as { shape: Record<string, unknown> }).shape

      expect(Object.keys(shape)).not.toContain('schoolId')
    }

    await tools.get('preview_enroll_family')?.handler({ schoolId: 'other-school' })

    expect(previewEnrollFamily).toHaveBeenCalledWith(scope, { schoolId: 'other-school' })
  })

  // `tools/list` convertit chaque `inputSchema` en JSON Schema, côté entrée, et exige un
  // objet à la racine. Un type sans représentation — `z.date()`, `z.coerce.date()` — y
  // jette, et le listing tombe pour **tous** les outils, lecture comprise. Mêmes options
  // que le SDK, parce que l'échec ne se voit nulle part ailleurs qu'en production.
  it('exposes only input schemas the tool listing can publish as JSON Schema', () => {
    for (const [name, tool] of build()) {
      const schema = tool.config.inputSchema as z.ZodType
      const convert = () => z.toJSONSchema(schema, { target: 'draft-2020-12', io: 'input' })

      expect(convert, name).not.toThrow()
      expect(convert().type ?? 'object', name).toBe('object')
    }
  })

  it('returns the use-case payload as JSON content on success', async () => {
    const result = await build().get('commit_enroll_family')?.handler({})

    expect(result?.isError).toBeUndefined()
    expect(payload(result as never)).toEqual({ familyId: 'family-1' })
  })

  it('turns a typed discriminant into a named tool error', async () => {
    commitEnrollFamily.mockResolvedValue('checksumMismatch')

    const result = await build().get('commit_enroll_family')?.handler({})

    expect(result?.isError).toBe(true)
    expect(payload(result as never)).toEqual({ error: 'checksumMismatch' })
  })

  it('hands create_event to its use case with the key scope and surfaces notConfigured', async () => {
    createEventFromMcp.mockResolvedValue('notConfigured')
    const args = { title: 'Fête', category: 'CELEBRATION', startAt: '2026-12-03' }

    const result = await build().get('create_event')?.handler(args)

    expect(createEventFromMcp).toHaveBeenCalledWith(scope, args)
    expect(result?.isError).toBe(true)
    expect(payload(result as never)).toEqual({ error: 'notConfigured' })
  })

  it('passes schedule operations the key scope and exposes typed refusals', async () => {
    const tools = build()
    const periodId = '00000000-0000-4000-8000-000000000001'
    listClassScheduleSlotsFromMcp.mockResolvedValue([{ id: 'slot-1' }])
    createClassScheduleSlotFromMcp.mockResolvedValue('classOverlap')
    deleteClassScheduleSlotFromMcp.mockResolvedValue({ deleted: true })

    const listed = await tools.get('list_class_schedule_slots')?.handler({ periodId })
    const created = await tools.get('create_class_schedule_slot')?.handler({ weekday: 6 })
    const deleted = await tools.get('delete_class_schedule_slot')?.handler({ id: 'slot-1' })

    expect(listClassScheduleSlotsFromMcp).toHaveBeenCalledWith(scope, { periodId })
    expect(payload(listed as never)).toEqual([{ id: 'slot-1' }])
    expect(createClassScheduleSlotFromMcp).toHaveBeenCalledWith(scope, { weekday: 6 })
    expect(created?.isError).toBe(true)
    expect(payload(created as never)).toEqual({ error: 'classOverlap' })
    expect(payload(deleted as never)).toEqual({ deleted: true })
    expect(tools.get('delete_class_schedule_slot')?.config.annotations).toMatchObject({
      destructiveHint: true,
    })
  })

  it('hides an unexpected throw behind a fixed refusal, never its message', async () => {
    previewRecordPayment.mockRejectedValue(
      new Error('relation "Payment" does not exist on host db.internal')
    )

    const result = await build().get('preview_record_payment')?.handler({})

    expect(result?.isError).toBe(true)
    expect(payload(result as never)).toEqual({ error: 'internalError' })
    expect(result?.content[0].text).not.toContain('db.internal')
  })

  it('logs the hidden detail server-side, so the refusal stays diagnosable', async () => {
    const failure = new Error('boom')
    commitRecordPayment.mockRejectedValue(failure)

    await build().get('commit_record_payment')?.handler({})

    expect(console.error).toHaveBeenCalledWith('[mcp] commit_record_payment', failure)
  })
})
