import { describe, expect, it, vi } from 'vitest'
import {
  archiveClassPeriodFromMcp,
  archiveLevelFromMcp,
  archivePlanFromMcp,
  archiveStudentFromMcp,
  deleteFamilyFromMcp,
  getFamilyDeletionImpactFromMcp,
} from './delete-resources'

const scope = { schoolId: 'school-1' }
const id = '00000000-0000-4000-8000-000000000001'
const input = { id, schoolId: 'other-school' }

describe('getFamilyDeletionImpactFromMcp', () => {
  it('reads only the scoped family, including archived data, and returns the deletion impact', async () => {
    const family = { id, name: 'Famille Démo' }
    const impact = { members: 2, students: 1, enrollments: 1, payments: 3, attendances: 4 }
    const gw = {
      findByIdIncludingArchived: vi.fn().mockResolvedValue(family),
      countDeletionImpact: vi.fn().mockResolvedValue(impact),
    }
    expect(await getFamilyDeletionImpactFromMcp(scope, input, gw)).toEqual({ family, impact })
    expect(gw.findByIdIncludingArchived).toHaveBeenCalledWith('school-1', id)
    expect(gw.countDeletionImpact).toHaveBeenCalledWith('school-1', id)
  })

  it('does not reveal impact when the family is absent from the school', async () => {
    const gw = {
      findByIdIncludingArchived: vi.fn().mockResolvedValue(null),
      countDeletionImpact: vi.fn(),
    }
    expect(await getFamilyDeletionImpactFromMcp(scope, { id }, gw)).toBe('notFound')
    expect(gw.countDeletionImpact).not.toHaveBeenCalled()
  })

  it('rejects invalid IDs before reading', async () => {
    const gw = { findByIdIncludingArchived: vi.fn(), countDeletionImpact: vi.fn() }
    expect(await getFamilyDeletionImpactFromMcp(scope, { id: 'invalid' }, gw)).toBe(
      'validationError'
    )
    expect(gw.findByIdIncludingArchived).not.toHaveBeenCalled()
  })
})

describe('deleteFamilyFromMcp', () => {
  it('passes the name confirmation to the existing deletion use case in the scoped school', async () => {
    const remove = vi.fn().mockResolvedValue('OK')
    expect(
      await deleteFamilyFromMcp(scope, { ...input, confirmation: ' Famille Démo ' }, remove)
    ).toEqual({ id, deleted: true })
    expect(remove).toHaveBeenCalledWith({ id, confirmation: 'Famille Démo', schoolId: 'school-1' })
  })

  it.each([
    { id: 'invalid', confirmation: 'Démo' },
    { id, confirmation: '  ' },
    { id, confirmation: 'a'.repeat(51) },
  ])('rejects invalid input without deleting: %j', async (bad) => {
    const remove = vi.fn()
    expect(await deleteFamilyFromMcp(scope, bad, remove)).toBe('validationError')
    expect(remove).not.toHaveBeenCalled()
  })

  it.each(['confirmationMismatch', 'notFound', 'deletionBlocked', 'deletionConflict'])(
    'preserves the deletion refusal %s',
    async (refusal) => {
      const remove = vi.fn().mockResolvedValue(refusal)
      expect(await deleteFamilyFromMcp(scope, { id, confirmation: 'Démo' }, remove)).toBe(refusal)
    }
  )
})

const operations = [
  ['student', archiveStudentFromMcp, 'hasActiveEnrollments'],
  ['class', archiveClassPeriodFromMcp, 'classInUse'],
  ['level', archiveLevelFromMcp, 'levelInUse'],
  ['plan', archivePlanFromMcp, 'planInUse'],
] as const

for (const [name, run, refusal] of operations) {
  describe(`archive ${name} from MCP`, () => {
    it('takes the school only from scope and returns a success object rather than an error string', async () => {
      const archive = vi.fn().mockResolvedValue('OK')
      expect(await run(scope, input, archive)).toEqual({ id, archived: true })
      expect(archive).toHaveBeenCalledWith({ id, schoolId: 'school-1' })
    })

    it('rejects invalid IDs without writing', async () => {
      const archive = vi.fn()
      expect(await run(scope, { id: 'invalid' }, archive)).toBe('validationError')
      expect(archive).not.toHaveBeenCalled()
    })

    it.each([refusal, 'notFound'])('preserves the refusal %s', async (error) => {
      const archive = vi.fn().mockResolvedValue(error)
      expect(await run(scope, { id }, archive)).toBe(error)
    })
  })
}

it('preserves the reserved-plan and disabled-payment protections', async () => {
  for (const result of ['unpricedPlan', 'paymentsDisabled']) {
    expect(await archivePlanFromMcp(scope, { id }, vi.fn().mockResolvedValue(result))).toBe(result)
  }
})
