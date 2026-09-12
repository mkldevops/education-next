import { beforeEach, describe, expect, it, vi } from 'vitest'

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

const findActiveById = vi.fn()
const listLevels = vi.fn()
const listPeriods = vi.fn()
const listClassPeriods = vi.fn()
const listPlans = vi.fn()
const listTeachers = vi.fn()
const previewEnrollFamily = vi.fn()
const commitEnrollFamily = vi.fn()
const previewRecordPayment = vi.fn()
const commitRecordPayment = vi.fn()

vi.mock('@modelcontextprotocol/server', () => ({ McpServer: FakeMcpServer }))
vi.mock('@/gateways/school-gateway', () => ({ schoolGateway: { findActiveById } }))
vi.mock('@/use-cases/levels/list-levels', () => ({ listLevels }))
vi.mock('@/use-cases/periods/list-periods', () => ({ listPeriods }))
vi.mock('@/use-cases/class-periods/list-class-periods', () => ({ listClassPeriods }))
vi.mock('@/use-cases/plans/list-plans', () => ({ listPlans }))
vi.mock('@/use-cases/teachers/list-teachers', () => ({ listTeachers }))
vi.mock('@/use-cases/mcp/preview-enroll-family', () => ({ previewEnrollFamily }))
vi.mock('@/use-cases/mcp/commit-enroll-family', () => ({ commitEnrollFamily }))
vi.mock('@/use-cases/mcp/preview-record-payment', () => ({ previewRecordPayment }))
vi.mock('@/use-cases/mcp/commit-record-payment', () => ({ commitRecordPayment }))

const { buildMcpServer } = await import('./server')

const scope = {
  keyId: 'key-1',
  keyPrefix: 'edu_mcp_aaaa',
  userId: 'user-1',
  schoolId: 'school-1',
  isSuperAdmin: false as const,
}

const build = () => {
  registered.clear()
  buildMcpServer(scope)
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
  it('publishes the six reads and the two preview/commit pairs', () => {
    expect([...build().keys()]).toEqual([
      'describe_school',
      'list_levels',
      'list_periods',
      'list_class_periods',
      'list_plans',
      'list_teachers',
      'preview_enroll_family',
      'commit_enroll_family',
      'preview_record_payment',
      'commit_record_payment',
    ])
  })

  it('marks previews read-only and commits non-destructive and idempotent', () => {
    const tools = build()

    for (const name of ['preview_enroll_family', 'preview_record_payment']) {
      expect(tools.get(name)?.config.annotations).toMatchObject({ readOnlyHint: true })
    }
    for (const name of ['commit_enroll_family', 'commit_record_payment']) {
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
