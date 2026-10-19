import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Les types `Omit<…, 'schoolId' | 'id'>` n'existent pas à l'exécution : un client peut
 * poster `schoolId` et `id` dans `data`. L'école et la cible doivent toujours venir de la
 * session et de l'argument dédié, jamais du corps de la requête.
 */
vi.mock('./auth-helper', () => ({ requireSchoolAdmin: vi.fn(), requireSchoolStaff: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/gateways/person-gateway', () => ({ personGateway: {} }))
vi.mock('@/use-cases/families/update-family', () => ({ updateFamily: vi.fn() }))
vi.mock('@/use-cases/students/update-student', () => ({ updateStudent: vi.fn() }))
vi.mock('@/use-cases/periods/update-period', () => ({ updatePeriod: vi.fn() }))

const auth = await import('./auth-helper')
const { updateFamily } = await import('@/use-cases/families/update-family')
const { updateStudent } = await import('@/use-cases/students/update-student')
const { updatePeriod } = await import('@/use-cases/periods/update-period')
const { updateFamilyAction } = await import('./family-actions')
const { updateStudentAction } = await import('./student-actions')
const { updatePeriodAction } = await import('./period-actions')

const TARGET_ID = '00000000-0000-4000-8000-000000000001'
const FOREIGN_ID = '00000000-0000-4000-8000-000000000099'
const forged = { schoolId: 'school-b', id: FOREIGN_ID }

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(auth.requireSchoolAdmin).mockResolvedValue({
    schoolId: 'school-a',
    userId: 'u',
    isSuperAdmin: false,
  })
  vi.mocked(auth.requireSchoolStaff).mockResolvedValue({
    schoolId: 'school-a',
    userId: 'u',
    isAdmin: true,
  })
})

describe('mises à jour : école et cible venues du client ignorées', () => {
  it('updateFamilyAction garde le schoolId de session et l’id en argument', async () => {
    vi.mocked(updateFamily).mockResolvedValue('notFound')

    await updateFamilyAction(TARGET_ID, { name: 'Famille', ...forged } as never)

    expect(updateFamily).toHaveBeenCalledWith(
      expect.objectContaining({ schoolId: 'school-a', id: TARGET_ID, name: 'Famille' })
    )
  })

  it('updateStudentAction garde le schoolId de session et l’id en argument', async () => {
    vi.mocked(updateStudent).mockResolvedValue('notFound')

    await updateStudentAction(TARGET_ID, { ...forged } as never)

    expect(updateStudent).toHaveBeenCalledWith(
      expect.objectContaining({ schoolId: 'school-a', id: TARGET_ID })
    )
  })

  it('updatePeriodAction garde le schoolId de session et l’id en argument', async () => {
    vi.mocked(updatePeriod).mockResolvedValue('notFound')

    await updatePeriodAction(TARGET_ID, { name: '2026', ...forged } as never)

    expect(updatePeriod).toHaveBeenCalledWith(
      expect.objectContaining({ schoolId: 'school-a', id: TARGET_ID, name: '2026' })
    )
  })
})
