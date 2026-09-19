import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Prisma } from '@/generated/prisma/client'

vi.mock('./auth-helper', () => ({ requireSchoolAdmin: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/use-cases/enrollments/create-enrollment', () => ({ createEnrollment: vi.fn() }))

const auth = await import('./auth-helper')
const { revalidatePath } = await import('next/cache')
const { createEnrollment } = await import('@/use-cases/enrollments/create-enrollment')
const { createEnrollmentAction } = await import('./enrollment-actions')

const input = {
  studentId: '00000000-0000-4000-8000-000000000001',
  planId: '00000000-0000-4000-8000-000000000002',
  classPeriodId: '00000000-0000-4000-8000-000000000003',
  totalAmount: 490,
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(auth.requireSchoolAdmin).mockResolvedValue({
    schoolId: 's',
    userId: 'u',
    isSuperAdmin: false,
  })
})

describe('createEnrollmentAction', () => {
  it('returns only the serializable id instead of the Prisma row with Decimal fields', async () => {
    vi.mocked(createEnrollment).mockResolvedValue({
      id: 'e1',
      totalAmount: new Prisma.Decimal(490),
      discount: new Prisma.Decimal(0),
    } as never)

    const result = await createEnrollmentAction(input)

    expect(result).toEqual({ id: 'e1' })
    expect(createEnrollment).toHaveBeenCalledWith({ ...input, schoolId: 's' })
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard/enrollments')
  })

  it('passes business error codes through without revalidating', async () => {
    vi.mocked(createEnrollment).mockResolvedValue('totalAmountExceedsPlan')

    expect(await createEnrollmentAction(input)).toBe('totalAmountExceedsPlan')
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('checks admin access before calling the use case', async () => {
    vi.mocked(auth.requireSchoolAdmin).mockRejectedValue(new Error('forbidden'))

    await expect(createEnrollmentAction(input)).rejects.toThrow('forbidden')
    expect(createEnrollment).not.toHaveBeenCalled()
  })
})
