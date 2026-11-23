import { describe, expect, it, vi } from 'vitest'
import { createFamilyForStudent } from './create-family-for-student'

type Gateway = Parameters<typeof createFamilyForStudent>[1]

const input = {
  schoolId: 'school-a',
  studentId: '7f9c2b6e-1d3a-4c5b-8e9f-0a1b2c3d4e5f',
  createdById: 'user-1',
  name: '  Petit ',
}

const gatewayReturning = (result: unknown) =>
  ({ createForStudent: vi.fn().mockResolvedValue(result) }) as unknown as Gateway & {
    createForStudent: ReturnType<typeof vi.fn>
  }

describe('createFamilyForStudent', () => {
  it('creates the family in the caller school with a trimmed name', async () => {
    const gateway = gatewayReturning({ id: 'family-1', name: 'Petit' })
    expect(await createFamilyForStudent(input, gateway)).toEqual({ id: 'family-1', name: 'Petit' })
    expect(gateway.createForStudent).toHaveBeenCalledWith(input.schoolId, input.studentId, {
      name: 'Petit',
      emergencyContactName: undefined,
      emergencyContactPhone: undefined,
      createdById: 'user-1',
    })
  })

  it('keeps the optional emergency contact', async () => {
    const gateway = gatewayReturning({ id: 'family-1', name: 'Petit' })
    await createFamilyForStudent(
      { ...input, emergencyContactName: 'Marie Petit', emergencyContactPhone: '06 12 34 56 78' },
      gateway
    )
    expect(gateway.createForStudent).toHaveBeenCalledWith(
      input.schoolId,
      input.studentId,
      expect.objectContaining({
        emergencyContactName: 'Marie Petit',
        emergencyContactPhone: '06 12 34 56 78',
      })
    )
  })

  it.each([
    { name: '   ' },
    { name: 'x'.repeat(51) },
    { studentId: 'nope' },
    { emergencyContactPhone: 'abc' },
  ])('rejects invalid input %o before touching the database', async (patch) => {
    const gateway = gatewayReturning({ id: 'family-1', name: 'Petit' })
    expect(await createFamilyForStudent({ ...input, ...patch }, gateway)).toBe('validationError')
    expect(gateway.createForStudent).not.toHaveBeenCalled()
  })

  it('passes through a refusal from the gateway', async () => {
    expect(await createFamilyForStudent(input, gatewayReturning('hasFamily'))).toBe('hasFamily')
    expect(await createFamilyForStudent(input, gatewayReturning('notFound'))).toBe('notFound')
  })
})
