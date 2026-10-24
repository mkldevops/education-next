import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ classes: vi.fn(), config: vi.fn(), teacher: vi.fn() }))
vi.mock('@/lib/school-regional-settings', () => ({
  getSchoolRegionalSettings: async () => ({ currency: 'EUR', timeZone: 'Europe/Paris' }),
}))
vi.mock('next/server', () => ({ connection: async () => {} }))
vi.mock('next-intl/server', () => ({
  setRequestLocale: () => {},
  getTranslations: async () => (key: string, values?: { name?: string }) =>
    values?.name ? `${key} ${values.name}` : key,
}))
vi.mock('@peaklab/ui', () => ({ Breadcrumbs: () => null }))
vi.mock('@/i18n/routing', () => ({
  Link: ({ children, ...props }: { children: ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  ),
}))
vi.mock('@/lib/db', () => ({
  db: { classPeriod: { findMany: mocks.classes }, config: { findFirst: mocks.config } },
}))
vi.mock('../../_lib/auth-helper', () => ({ requireTeacher: mocks.teacher }))

const { default: MyClassesPage } = await import('./page')
const renderPage = async () =>
  render(await MyClassesPage({ params: Promise.resolve({ locale: 'fr' }) }))

beforeEach(() => {
  vi.clearAllMocks()
  mocks.teacher.mockResolvedValue({ schoolId: 'school-1', teacherId: 'teacher-1' })
  mocks.config.mockResolvedValue({ value: 'true' })
  mocks.classes.mockResolvedValue([
    { id: 'class-1', name: 'CP A', level: { name: 'CP' }, period: { name: '2026-2027' } },
    { id: 'class-2', name: 'CP B', level: { name: 'CP' }, period: { name: '2026-2027' } },
  ])
})

describe('MyClassesPage', () => {
  it('renders each class with its own named attendance link and preserves teacher scoping', async () => {
    await renderPage()
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getByRole('heading', { name: 'CP A' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'attendanceFor CP A' })).toHaveAttribute(
      'href',
      `/dashboard/my-classes/class-1/attendance?date=${new Date().toISOString().slice(0, 10)}`
    )
    expect(mocks.classes).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          schoolId: 'school-1',
          isActive: true,
          teachers: { some: { teacherId: 'teacher-1' } },
        },
      })
    )
  })

  it('does not offer attendance when the feature is disabled', async () => {
    mocks.config.mockResolvedValue({ value: 'false' })
    await renderPage()
    expect(screen.queryByRole('link', { name: /attendanceFor/ })).not.toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'viewClass' })[0]).toHaveAttribute(
      'href',
      '/dashboard/my-classes/class-1'
    )
    expect(screen.getByText('subtitleReadOnly')).toBeInTheDocument()
  })

  it('shows a useful empty state without an attendance action', async () => {
    mocks.classes.mockResolvedValue([])
    await renderPage()
    expect(screen.getByRole('heading', { name: 'emptyTitle' })).toBeInTheDocument()
    expect(screen.getByText('empty')).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})
