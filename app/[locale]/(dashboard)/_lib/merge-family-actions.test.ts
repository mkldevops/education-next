import { beforeEach, expect, it, vi } from 'vitest'

vi.mock('./auth-helper', () => ({ requireSchoolAdmin: vi.fn(), requireSchoolStaff: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/use-cases/families/merge-families', () => ({ mergeFamilies: vi.fn() }))
const { requireSchoolAdmin } = await import('./auth-helper')
const { revalidatePath } = await import('next/cache')
const { mergeFamilies } = await import('@/use-cases/families/merge-families')
const { mergeFamiliesAction } = await import('./family-actions')

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireSchoolAdmin).mockResolvedValue({
    schoolId: 'school-a',
    userId: 'admin',
    isSuperAdmin: false,
  })
  vi.mocked(mergeFamilies).mockResolvedValue('OK')
})
it('takes school from the admin session and refreshes the dashboard only after success', async () => {
  expect(await mergeFamiliesAction('source', 'target')).toBe('OK')
  expect(mergeFamilies).toHaveBeenCalledWith({
    schoolId: 'school-a',
    sourceId: 'source',
    targetId: 'target',
  })
  expect(revalidatePath).toHaveBeenCalledWith('/dashboard', 'layout')
})
it('does not mutate without admin authorization', async () => {
  vi.mocked(requireSchoolAdmin).mockRejectedValueOnce(new Error('forbidden'))
  await expect(mergeFamiliesAction('source', 'target')).rejects.toThrow('forbidden')
  expect(mergeFamilies).not.toHaveBeenCalled()
})
it('keeps business errors and does not revalidate on failure', async () => {
  vi.mocked(mergeFamilies).mockResolvedValue('pendingPayment')
  expect(await mergeFamiliesAction('source', 'target')).toBe('pendingPayment')
  expect(revalidatePath).not.toHaveBeenCalled()
})
