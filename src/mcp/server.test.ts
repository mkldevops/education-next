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

const previewMergeFamilies = vi.fn()
const commitMergeFamilies = vi.fn()
const previewSplitFamily = vi.fn()
const commitSplitFamily = vi.fn()
const previewEnrollFamily = vi.fn()
const commitEnrollFamily = vi.fn()
const previewRecordPayment = vi.fn()
const commitRecordPayment = vi.fn()
const previewUpdateEnrollment = vi.fn()
const commitUpdateEnrollment = vi.fn()
const createEventFromMcp = vi.fn()
const listEventsFromMcp = vi.fn()
const listAttendanceCallsFromMcp = vi.fn()
const getEventFromMcp = vi.fn()
const updateEventFromMcp = vi.fn()
const duplicateEventFromMcp = vi.fn()
const previewClassSchedule = vi.fn()
const commitClassSchedule = vi.fn()
const listClassScheduleSlotsFromMcp = vi.fn()
const createClassScheduleSlotFromMcp = vi.fn()
const updateClassScheduleSlotFromMcp = vi.fn()
const deleteClassScheduleSlotFromMcp = vi.fn()
const createPlanFromMcp = vi.fn()
const updatePlanFromMcp = vi.fn()
const createLevelFromMcp = vi.fn()
const createClassPeriodFromMcp = vi.fn()
const getFamilyDeletionImpactFromMcp = vi.fn()
const deleteFamilyFromMcp = vi.fn()
const archiveStudentFromMcp = vi.fn()
const archiveClassPeriodFromMcp = vi.fn()
const archiveLevelFromMcp = vi.fn()
const archivePlanFromMcp = vi.fn()
const moveStudentToClassFromMcp = vi.fn()

vi.mock('@modelcontextprotocol/server', () => ({ McpServer: FakeMcpServer }))
vi.mock('@/gateways/mcp-read-gateway', () => ({ mcpReadGateway }))
vi.mock('@/use-cases/mcp/preview-merge-families', () => ({ previewMergeFamilies }))
vi.mock('@/use-cases/mcp/commit-merge-families', () => ({ commitMergeFamilies }))
vi.mock('@/use-cases/mcp/preview-split-family', () => ({ previewSplitFamily }))
vi.mock('@/use-cases/mcp/commit-split-family', () => ({ commitSplitFamily }))
vi.mock('@/use-cases/mcp/preview-enroll-family', () => ({ previewEnrollFamily }))
vi.mock('@/use-cases/mcp/commit-enroll-family', () => ({ commitEnrollFamily }))
vi.mock('@/use-cases/mcp/preview-record-payment', () => ({ previewRecordPayment }))
vi.mock('@/use-cases/mcp/commit-record-payment', () => ({ commitRecordPayment }))
vi.mock('@/use-cases/mcp/preview-update-enrollment', () => ({ previewUpdateEnrollment }))
vi.mock('@/use-cases/mcp/commit-update-enrollment', () => ({ commitUpdateEnrollment }))
vi.mock('@/use-cases/mcp/create-event', () => ({ createEventFromMcp }))
vi.mock('@/use-cases/mcp/list-events', () => ({ listEventsFromMcp }))
vi.mock('@/use-cases/mcp/list-attendance-calls', () => ({ listAttendanceCallsFromMcp }))
vi.mock('@/use-cases/mcp/get-event', () => ({ getEventFromMcp }))
vi.mock('@/use-cases/mcp/update-event', () => ({ updateEventFromMcp }))
vi.mock('@/use-cases/mcp/duplicate-event', () => ({ duplicateEventFromMcp }))
vi.mock('@/use-cases/mcp/plan-configuration', () => ({ createPlanFromMcp, updatePlanFromMcp }))
vi.mock('@/use-cases/mcp/create-level', () => ({ createLevelFromMcp }))
vi.mock('@/use-cases/mcp/create-class-period', () => ({ createClassPeriodFromMcp }))
vi.mock('@/use-cases/mcp/move-student-to-class', () => ({ moveStudentToClassFromMcp }))
vi.mock('@/use-cases/mcp/delete-resources', () => ({
  getFamilyDeletionImpactFromMcp,
  deleteFamilyFromMcp,
  archiveStudentFromMcp,
  archiveClassPeriodFromMcp,
  archiveLevelFromMcp,
  archivePlanFromMcp,
}))
vi.mock('@/use-cases/mcp/preview-class-schedule', () => ({ previewClassSchedule }))
vi.mock('@/use-cases/mcp/commit-class-schedule', () => ({ commitClassSchedule }))
vi.mock('@/use-cases/mcp/class-schedule', () => ({
  listClassScheduleSlotsFromMcp,
  createClassScheduleSlotFromMcp,
  updateClassScheduleSlotFromMcp,
  deleteClassScheduleSlotFromMcp,
}))

const { buildMcpServer } = await import('./server')

const scope = {
  credentialId: 'key-1',
  credentialPrefix: 'edu_mcp_aaaa',
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
  it('publishes the reads, the schedule and event tools and the six preview/commit pairs when payments are enabled', () => {
    expect([...build().keys()]).toEqual([
      'get_meal_settings',
      'get_student_meals',
      'get_staff_meals',
      'list_staff_meal_subscriptions',
      'list_family_receipts',
      'set_meal_service_setting',
      'set_meal_price',
      'remove_meal_price',
      'subscribe_meal',
      'subscribe_staff_meal',
      'change_meal_schedule',
      'stop_meal',
      'record_meal_opening',
      'toggle_meal_absence',
      'record_receipt',
      'cancel_receipt',
      'get_student_childcare',
      'save_childcare_subscription',
      'bill_childcare_month',
      'record_childcare_opening',
      'cancel_childcare_charge',
      'describe_school',
      'list_levels',
      'create_level',
      'list_periods',
      'list_class_periods',
      'create_class_period',
      'list_class_schedule_slots',
      'create_class_schedule_slot',
      'update_class_schedule_slot',
      'delete_class_schedule_slot',
      'preview_class_schedule',
      'commit_class_schedule',
      'list_attendance_calls',
      'list_plans',
      'create_plan',
      'update_plan',
      'list_teachers',
      'create_teacher',
      'assign_teacher_to_class',
      'preview_record_teacher_expense',
      'commit_record_teacher_expense',
      'find_students',
      'list_families',
      'preview_merge_families',
      'commit_merge_families',
      'preview_split_family',
      'commit_split_family',
      'get_family_deletion_impact',
      'delete_family',
      'archive_student',
      'archive_class_period',
      'archive_level',
      'archive_plan',
      'preview_enroll_family',
      'commit_enroll_family',
      'move_student_to_class',
      'create_event',
      'list_events',
      'get_event',
      'update_event',
      'duplicate_event',
      'preview_record_payment',
      'commit_record_payment',
      'preview_update_enrollment',
      'commit_update_enrollment',
      'list_overdue_students',
      'get_family_payments',
      'cancel_payments',
    ])
  })

  it('omits the money tools when the school has turned payments off', () => {
    expect([...build({ paymentsEnabled: false }).keys()]).toEqual([
      'get_meal_settings',
      'get_student_meals',
      'get_staff_meals',
      'list_staff_meal_subscriptions',
      'list_family_receipts',
      'set_meal_service_setting',
      'set_meal_price',
      'remove_meal_price',
      'subscribe_meal',
      'subscribe_staff_meal',
      'change_meal_schedule',
      'stop_meal',
      'record_meal_opening',
      'toggle_meal_absence',
      'record_receipt',
      'cancel_receipt',
      'get_student_childcare',
      'save_childcare_subscription',
      'bill_childcare_month',
      'record_childcare_opening',
      'cancel_childcare_charge',
      'describe_school',
      'list_levels',
      'create_level',
      'list_periods',
      'list_class_periods',
      'create_class_period',
      'list_class_schedule_slots',
      'create_class_schedule_slot',
      'update_class_schedule_slot',
      'delete_class_schedule_slot',
      'preview_class_schedule',
      'commit_class_schedule',
      'list_attendance_calls',
      'list_teachers',
      'create_teacher',
      'assign_teacher_to_class',
      'preview_record_teacher_expense',
      'commit_record_teacher_expense',
      'find_students',
      'list_families',
      'preview_merge_families',
      'commit_merge_families',
      'preview_split_family',
      'commit_split_family',
      'get_family_deletion_impact',
      'delete_family',
      'archive_student',
      'archive_class_period',
      'archive_level',
      'archive_plan',
      'preview_enroll_family',
      'commit_enroll_family',
      'move_student_to_class',
      'create_event',
      'list_events',
      'get_event',
      'update_event',
      'duplicate_event',
    ])
  })

  it('declares previews as writers and commits as non-destructive and idempotent', () => {
    const tools = build()

    for (const name of [
      'preview_enroll_family',
      'preview_merge_families',
      'preview_split_family',
      'preview_class_schedule',
      'preview_record_teacher_expense',
      'preview_record_payment',
      'preview_update_enrollment',
    ]) {
      expect(tools.get(name)?.config.annotations).toMatchObject({
        readOnlyHint: false,
        idempotentHint: false,
      })
    }
    for (const name of ['commit_merge_families', 'commit_split_family']) {
      expect(tools.get(name)?.config.annotations).toMatchObject({
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
      })
    }
    for (const name of [
      'commit_enroll_family',
      'commit_class_schedule',
      'commit_record_teacher_expense',
      'commit_record_payment',
      'commit_update_enrollment',
    ]) {
      expect(tools.get(name)?.config.annotations).toMatchObject({
        destructiveHint: false,
        idempotentHint: true,
      })
    }
  })

  it('moves a student to another class with the caller scope and returns typed errors', async () => {
    const tools = build()
    const args = { studentName: 'Houmaira', studentLastname: 'Cheikh', classPeriodId: 'class' }
    moveStudentToClassFromMcp.mockResolvedValueOnce({ enrollmentId: 'e', classPeriodId: 'class' })
    moveStudentToClassFromMcp.mockResolvedValueOnce('classFull')

    const moved = await tools.get('move_student_to_class')?.handler(args)
    const full = await tools.get('move_student_to_class')?.handler(args)

    expect(moveStudentToClassFromMcp).toHaveBeenCalledWith(scope, args)
    expect(tools.get('move_student_to_class')?.config.annotations).toMatchObject({
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
    })
    expect(payload(moved as never)).toEqual({ enrollmentId: 'e', classPeriodId: 'class' })
    expect(full?.isError).toBe(true)
    expect(payload(full as never)).toEqual({ error: 'classFull' })
  })

  it('delegates family merge with the caller scope and returns typed errors', async () => {
    const tools = build()
    const previewArgs = { sourceId: 'source', targetId: 'target', schoolId: 'other-school' }
    const commitArgs = { draftId: 'draft', checksum: 'checksum' }
    previewMergeFamilies.mockResolvedValue({ draftId: 'draft', blockers: [] })
    commitMergeFamilies.mockResolvedValue('staleDraft')

    const preview = await tools.get('preview_merge_families')?.handler(previewArgs)
    const commit = await tools.get('commit_merge_families')?.handler(commitArgs)

    expect(previewMergeFamilies).toHaveBeenCalledWith(scope, previewArgs)
    expect(commitMergeFamilies).toHaveBeenCalledWith(scope, commitArgs)
    expect(payload(preview as never)).toEqual({ draftId: 'draft', blockers: [] })
    expect(commit?.isError).toBe(true)
    expect(payload(commit as never)).toEqual({ error: 'staleDraft' })
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

  it('exposes school setup tools as non-destructive writes, even without payments', async () => {
    const tools = build({ paymentsEnabled: false })
    const level = { name: 'CP' }
    const classPeriod = {
      name: 'CP',
      capacity: 30,
      levelId: '00000000-0000-4000-8000-000000000001',
      periodId: '00000000-0000-4000-8000-000000000002',
    }
    createLevelFromMcp.mockResolvedValue({ id: 'level-1', name: 'CP' })
    createClassPeriodFromMcp.mockResolvedValue('levelNotFound')

    expect(payload(await tools.get('create_level')!.handler(level))).toEqual({
      id: 'level-1',
      name: 'CP',
    })
    const refused = await tools.get('create_class_period')!.handler(classPeriod)
    expect(refused.isError).toBe(true)
    expect(payload(refused)).toEqual({ error: 'levelNotFound' })
    expect(createLevelFromMcp).toHaveBeenCalledWith({ ...scope, paymentsEnabled: false }, level)
    expect(createClassPeriodFromMcp).toHaveBeenCalledWith(
      { ...scope, paymentsEnabled: false },
      classPeriod
    )

    for (const name of ['create_level', 'create_class_period']) {
      expect(tools.get(name)?.config.annotations).toMatchObject({
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      })
    }
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

  it('marks deletion and archival as destructive and forwards only the authenticated scope', async () => {
    const tools = build()
    const id = '00000000-0000-4000-8000-000000000001'
    const handlers = [
      ['delete_family', deleteFamilyFromMcp, { id, confirmation: 'Démo' }],
      ['archive_student', archiveStudentFromMcp, { id }],
      ['archive_class_period', archiveClassPeriodFromMcp, { id }],
      ['archive_level', archiveLevelFromMcp, { id }],
      ['archive_plan', archivePlanFromMcp, { id }],
    ] as const
    for (const [name, handler, args] of handlers) {
      handler.mockResolvedValue({ id, archived: true })
      expect(tools.get(name)?.config.annotations).toMatchObject({
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: false,
      })
      const result = await tools.get(name)!.handler(args)
      expect(result.isError).not.toBe(true)
      expect(handler).toHaveBeenCalledWith(scope, args)
    }
    getFamilyDeletionImpactFromMcp.mockResolvedValue('notFound')
    expect(tools.get('get_family_deletion_impact')?.config.annotations).toMatchObject({
      readOnlyHint: true,
    })
    const result = await tools.get('get_family_deletion_impact')!.handler({ id })
    expect(result.isError).toBe(true)
    expect(payload(result)).toEqual({ error: 'notFound' })
    expect(getFamilyDeletionImpactFromMcp).toHaveBeenCalledWith(scope, { id })
  })

  it('publishes configuration writes only with payments and forwards the authenticated scope', async () => {
    const tools = build()
    const pricing = { mode: 'MONTHLY', amount: 100, months: 10 }
    createPlanFromMcp.mockResolvedValue({ id: 'plan-1', amount: '1000' })
    updatePlanFromMcp.mockResolvedValue('notFound')

    expect(
      payload((await tools.get('create_plan')?.handler({ name: 'Temps plein', pricing })) as never)
    ).toEqual({
      id: 'plan-1',
      amount: '1000',
    })
    expect(createPlanFromMcp).toHaveBeenCalledWith(scope, { name: 'Temps plein', pricing })
    const refused = await tools
      .get('update_plan')
      ?.handler({ id: 'plan-1', paymentSchedule: { mode: 'NONE' } })
    expect(updatePlanFromMcp).toHaveBeenCalledWith(scope, {
      id: 'plan-1',
      paymentSchedule: { mode: 'NONE' },
    })
    expect(refused?.isError).toBe(true)
    expect(payload(refused as never)).toEqual({ error: 'notFound' })
    expect(tools.get('create_plan')?.config.annotations).toMatchObject({
      readOnlyHint: false,
      idempotentHint: false,
    })
    expect(tools.get('update_plan')?.config.annotations).toMatchObject({
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
    })
    expect(build({ paymentsEnabled: false }).has('create_plan')).toBe(false)
    expect(build({ paymentsEnabled: false }).has('update_plan')).toBe(false)
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

  it('hands the event tools to their use cases with the key scope', async () => {
    const tools = build()
    const id = '123e4567-e89b-12d3-a456-426614174000'

    await tools.get('list_events')?.handler({ status: 'DRAFT' })
    await tools.get('get_event')?.handler({ id })
    await tools.get('update_event')?.handler({ id, title: 'Fête' })
    await tools.get('duplicate_event')?.handler({ id, title: 'Fête 2027' })

    expect(listEventsFromMcp).toHaveBeenCalledWith(scope, { status: 'DRAFT' })
    expect(getEventFromMcp).toHaveBeenCalledWith(scope, { id })
    expect(updateEventFromMcp).toHaveBeenCalledWith(scope, { id, title: 'Fête' })
    expect(duplicateEventFromMcp).toHaveBeenCalledWith(scope, { id, title: 'Fête 2027' })
  })

  it('hands list_attendance_calls to its use case with the key scope', async () => {
    const args = { periodId: '123e4567-e89b-12d3-a456-426614174000', from: '2026-09-26' }

    await build().get('list_attendance_calls')?.handler(args)

    expect(listAttendanceCallsFromMcp).toHaveBeenCalledWith(scope, args)
  })

  it('turns a read refusal into a named tool error', async () => {
    getEventFromMcp.mockResolvedValue('notFound')

    const result = await build().get('get_event')?.handler({})

    expect(result?.isError).toBe(true)
    expect(payload(result as never)).toEqual({ error: 'notFound' })
  })

  it('asks before overwriting a draft and never offers a status to publish it', () => {
    const tools = build()
    const schema = tools.get('update_event')?.config.inputSchema as { shape: object }

    expect(tools.get('update_event')?.config.annotations).toMatchObject({
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
    })
    expect(tools.get('duplicate_event')?.config.annotations).toMatchObject({
      readOnlyHint: false,
      idempotentHint: false,
    })
    expect(Object.keys(schema.shape)).not.toContain('status')
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

  it('hands the planning batch pair to its use cases with the key scope, whatever the payments flag', async () => {
    const tools = build({ paymentsEnabled: false })
    const periodId = '00000000-0000-4000-8000-000000000001'
    const slots = [{ className: 'C4', weekday: 6, startTime: '09:00', endTime: '12:00' }]
    previewClassSchedule.mockResolvedValue({ draftId: 'draft-3', blockers: [] })
    commitClassSchedule.mockResolvedValue('notConfigured')

    const previewed = await tools.get('preview_class_schedule')?.handler({ periodId, slots })
    const committed = await tools
      .get('commit_class_schedule')
      ?.handler({ draftId: 'draft-3', checksum: 'abcdef012345' })

    expect(previewClassSchedule).toHaveBeenCalledWith(
      { ...scope, paymentsEnabled: false },
      { periodId, slots }
    )
    expect(payload(previewed as never)).toEqual({ draftId: 'draft-3', blockers: [] })
    expect(commitClassSchedule).toHaveBeenCalledWith(
      { ...scope, paymentsEnabled: false },
      { draftId: 'draft-3', checksum: 'abcdef012345' }
    )
    expect(committed?.isError).toBe(true)
    expect(payload(committed as never)).toEqual({ error: 'notConfigured' })
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
