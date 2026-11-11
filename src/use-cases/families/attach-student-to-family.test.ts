import { describe, expect, it, vi } from 'vitest'
import { attachStudentToFamily } from './attach-student-to-family'

type Gateway = Parameters<typeof attachStudentToFamily>[1]

const input = {
  schoolId: 'school-a',
  studentId: '7f9c2b6e-1d3a-4c5b-8e9f-0a1b2c3d4e5f',
  familyId: '2a7d6f10-4c3b-4e8a-9b1c-6d5e4f3a2b1c',
}

const gatewayReturning = (result: string) =>
  ({ attachStudent: vi.fn().mockResolvedValue(result) }) as unknown as Gateway & {
    attachStudent: ReturnType<typeof vi.fn>
  }

describe('attachStudentToFamily', () => {
  it('attaches the student within the caller school', async () => {
    const gateway = gatewayReturning('OK')
    expect(await attachStudentToFamily(input, gateway)).toBe('OK')
    expect(gateway.attachStudent).toHaveBeenCalledWith(
      input.schoolId,
      input.familyId,
      input.studentId
    )
  })

  it('rejects malformed identifiers before touching the database', async () => {
    const gateway = gatewayReturning('OK')
    expect(await attachStudentToFamily({ ...input, familyId: 'nope' }, gateway)).toBe(
      'validationError'
    )
    expect(gateway.attachStudent).not.toHaveBeenCalled()
  })

  it('passes through a refusal from the gateway', async () => {
    expect(await attachStudentToFamily(input, gatewayReturning('hasFamily'))).toBe('hasFamily')
    expect(await attachStudentToFamily(input, gatewayReturning('notFound'))).toBe('notFound')
  })
})
