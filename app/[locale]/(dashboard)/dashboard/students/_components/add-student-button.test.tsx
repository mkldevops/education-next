import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AddStudentButton } from './add-student-button'

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }))

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
vi.mock('@/i18n/routing', () => ({ useRouter: () => ({ push: vi.fn(), replace }) }))
vi.mock('../../../_lib/student-actions', () => ({ createStudentAction: vi.fn() }))

describe('AddStudentButton', () => {
  it('opens the existing student form for the family picked first', () => {
    render(
      <AddStudentButton
        families={[
          { id: 'family-1', name: 'Benali' },
          { id: 'family-2', name: 'Durand' },
        ]}
        plans={[]}
        classes={[]}
        paymentsEnabled={false}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'title' }))
    expect(screen.queryByLabelText('firstname')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Durand' }))

    expect(screen.getByLabelText('firstname')).toBeInTheDocument()
    const familyInput = document.body.querySelector<HTMLInputElement>('input[name="familyId"]')
    expect(familyInput?.value).toBe('family-2')
    // Le nettoyage d'URL reste sur la liste des élèves, pas sur la fiche famille.
    expect(replace).toHaveBeenCalledWith('/dashboard/students', { scroll: false })
  })
})
