import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const dbMock = { classPeriod: { findFirst: vi.fn() } }
const requireSchoolAdminMock = vi.fn()

vi.mock('next/server', () => ({ connection: async () => {} }))
vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => key,
  setRequestLocale: () => {},
}))
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('notFound')
  },
}))
vi.mock('@/i18n/routing', () => ({ Link: () => null }))
vi.mock('@/lib/db', () => ({ db: dbMock }))
vi.mock('@/lib/branding', () => ({
  getBrandingConfig: async () => ({ logoUrl: null, schoolName: 'Al-Nour' }),
}))
vi.mock('../../../../../(dashboard)/_lib/auth-helper', () => ({
  requireSchoolAdmin: requireSchoolAdminMock,
}))

const { default: ClassRosterPrintPage } = await import('./page')

const params = Promise.resolve({ locale: 'fr', id: 'class-1' })

const assignment = (id: string, name: string, lastname: string, birthday: Date | null) => ({
  id,
  enrollment: { student: { birthday, person: { name, lastname } } },
})

const classPeriod = {
  name: 'C1 - 2026/2027',
  level: { name: 'C1' },
  period: { name: '2026/2027' },
  teachers: [{ teacher: { id: 't-1', firstName: 'Amina', lastName: 'Diallo' } }],
  classAssignments: [
    assignment('a-1', 'Yanis', 'Martin', null),
    assignment('a-2', 'Lina', 'Benali', new Date('2018-03-04T00:00:00')),
    assignment('a-3', 'Adam', 'Benali', null),
  ],
}

describe('ClassRosterPrintPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireSchoolAdminMock.mockResolvedValue({ schoolId: 'school-a' })
  })

  it('scopes the class lookup to the admin school', async () => {
    dbMock.classPeriod.findFirst.mockResolvedValue(classPeriod)

    await ClassRosterPrintPage({ params })

    expect(dbMock.classPeriod.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'class-1', schoolId: 'school-a' } })
    )
  })

  it('lists students sorted by last name then first name', async () => {
    dbMock.classPeriod.findFirst.mockResolvedValue(classPeriod)

    render(await ClassRosterPrintPage({ params }))

    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1)
    expect(rows.map((row) => within(row).getAllByRole('cell')[2].textContent)).toEqual([
      'Adam',
      'Lina',
      'Yanis',
    ])
    expect(screen.getByText('Diallo Amina')).toBeInTheDocument()
  })

  it('returns notFound when the class is outside the school', async () => {
    dbMock.classPeriod.findFirst.mockResolvedValue(null)

    await expect(ClassRosterPrintPage({ params })).rejects.toThrow('notFound')
  })

  it('shows the empty message when no student is assigned', async () => {
    dbMock.classPeriod.findFirst.mockResolvedValue({ ...classPeriod, classAssignments: [] })

    render(await ClassRosterPrintPage({ params }))

    expect(screen.getByText('empty')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})
