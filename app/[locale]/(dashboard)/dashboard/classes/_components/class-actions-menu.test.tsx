import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('@/i18n/routing', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  Link: ({ children }: { children: React.ReactNode }) => children,
}))
vi.mock('./edit-class-dialog', () => ({
  EditClassDialog: ({ triggerRole }: { triggerRole?: React.AriaRole }) => (
    <button type="button" role={triggerRole}>
      edit
    </button>
  ),
}))

const { ClassActionsMenu } = await import('./class-actions-menu')

describe('ClassActionsMenu', () => {
  it('places the edit action behind an accessible ellipsis menu', () => {
    render(
      <ClassActionsMenu
        classItem={{
          id: 'class-1',
          name: 'Niveau 1',
          capacity: 30,
          levelId: 'level-1',
          teacherIds: [],
        }}
        levels={[]}
        teachers={[]}
      />
    )

    const trigger = screen.getByRole('button', { name: 'actions' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(trigger)

    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('menuitem', { name: 'edit' })).toBeVisible()
  })
})
