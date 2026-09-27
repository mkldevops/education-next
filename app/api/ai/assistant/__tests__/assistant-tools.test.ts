import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

const listSchoolToolsMock = vi.fn()
const readRun = vi.fn()
const writeRun = vi.fn()

vi.mock('@/mcp/school-tools', () => ({ listSchoolTools: listSchoolToolsMock }))

const { buildAssistantTools, toolApprovalSecret } = await import('../_lib/assistant-tools')

const scope = {
  schoolId: 'school-1',
  userId: 'user-1',
  paymentsEnabled: true,
  owner: { kind: 'ADMIN_SESSION' as const, userId: 'user-1' },
}

const catalog = [
  {
    name: 'list_levels',
    title: 'Niveaux',
    description: 'read',
    inputSchema: z.object({}),
    kind: 'read',
    run: readRun,
  },
  {
    name: 'preview_enroll_family',
    title: 'Aperçu',
    description: 'draft',
    inputSchema: z.object({}),
    kind: 'draft',
    run: readRun,
  },
  {
    name: 'commit_enroll_family',
    title: 'Engager',
    description: 'write',
    inputSchema: z.object({ draftId: z.string() }),
    kind: 'write',
    run: writeRun,
  },
]

const execute = (tools: Record<string, unknown>, name: string, args: unknown) =>
  (tools[name] as { execute: (args: unknown, options: unknown) => Promise<unknown> }).execute(
    args,
    { toolCallId: 'call-1', messages: [] }
  )

beforeEach(() => {
  vi.clearAllMocks()
  listSchoolToolsMock.mockReturnValue(catalog)
})

describe('buildAssistantTools', () => {
  it('exposes the shared catalog, scoped to the session school', () => {
    const { toolNames } = buildAssistantTools(scope, 'secret')

    expect(listSchoolToolsMock).toHaveBeenCalledWith(scope)
    expect([...toolNames]).toEqual(['list_levels', 'preview_enroll_family', 'commit_enroll_family'])
  })

  it('asks the administrator before every write, never before a read or a preview', () => {
    const { toolApproval } = buildAssistantTools(scope, 'secret')

    expect(toolApproval).toEqual({ commit_enroll_family: 'user-approval' })
  })

  it('denies writes outright when approvals cannot be signed', () => {
    const { toolApproval } = buildAssistantTools(scope, null)

    expect(toolApproval).toEqual({
      commit_enroll_family: { type: 'denied', reason: 'approvalUnavailable' },
    })
  })

  it('turns a typed refusal into an error object the model can explain', async () => {
    writeRun.mockResolvedValue('draftExpired')
    const { tools } = buildAssistantTools(scope, 'secret')

    expect(await execute(tools, 'commit_enroll_family', { draftId: 'd' })).toEqual({
      error: 'draftExpired',
    })
  })

  it('hides an unexpected failure behind a fixed code', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    readRun.mockRejectedValue(new Error('db down: secret detail'))
    const { tools } = buildAssistantTools(scope, 'secret')

    expect(await execute(tools, 'list_levels', {})).toEqual({ error: 'internalError' })
    consoleError.mockRestore()
  })

  it('returns data results untouched', async () => {
    readRun.mockResolvedValue([{ id: 'level-1', name: 'CE1' }])
    const { tools } = buildAssistantTools(scope, 'secret')

    expect(await execute(tools, 'list_levels', {})).toEqual([{ id: 'level-1', name: 'CE1' }])
  })
})

describe('toolApprovalSecret', () => {
  it('derives a stable secret distinct from the Better Auth one', () => {
    const secret = toolApprovalSecret('auth-secret')

    expect(secret).toBeTruthy()
    expect(secret).not.toBe('auth-secret')
    expect(toolApprovalSecret('auth-secret')).toBe(secret)
  })

  it('is absent without a Better Auth secret', () => {
    expect(toolApprovalSecret('  ')).toBeNull()
    expect(toolApprovalSecret('')).toBeNull()
  })
})
