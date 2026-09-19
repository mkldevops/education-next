import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CreateEnrollmentDialog } from './create-enrollment-dialog'

const replace = vi.hoisted(() => vi.fn())
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
vi.mock('@/i18n/routing', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace }),
}))
// Action serveur réelle : exigerait une session et une base, hors de portée d'un test de
// rendu pur qui ne soumet jamais le formulaire.
vi.mock('../../../_lib/enrollment-actions', () => ({
  createEnrollmentAction: vi.fn(),
}))

const students = [{ id: 'student-1', name: 'Alice Martin' }]
const plans = [{ id: 'plan-1', name: 'Tarif annuel' }]
const classes = [{ id: 'class-1', name: 'CE1' }]

function openDialog() {
  fireEvent.click(screen.getByRole('button', { name: 'title' }))
}

describe('CreateEnrollmentDialog with payments enabled', () => {
  it('shows the plan selector and the amount due field', () => {
    render(
      <CreateEnrollmentDialog
        students={students}
        plans={plans}
        classes={classes}
        paymentsEnabled={true}
      />
    )
    openDialog()

    expect(screen.getByLabelText('selectPlan')).toBeInTheDocument()
    expect(screen.getByLabelText('totalAmount')).toBeInTheDocument()
    expect(screen.getByLabelText('selectClass')).toBeInTheDocument()
  })
})

describe('CreateEnrollmentDialog with payments disabled', () => {
  it('hides the plan selector and the amount due field, keeping the class selector', () => {
    render(
      <CreateEnrollmentDialog
        students={students}
        plans={plans}
        classes={classes}
        paymentsEnabled={false}
      />
    )
    openDialog()

    expect(screen.queryByLabelText('selectPlan')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('totalAmount')).not.toBeInTheDocument()
    expect(screen.getByLabelText('selectClass')).toBeInTheDocument()
  })
})

describe('CreateEnrollmentDialog opened from a deep link', () => {
  it('opens the dialog and cleans the URL once, to the caller page', () => {
    replace.mockClear()
    render(
      <CreateEnrollmentDialog
        students={students}
        plans={plans}
        classes={classes}
        paymentsEnabled={true}
        defaultOpen
        redirectTo="/dashboard/students"
      />
    )

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(replace).toHaveBeenCalledTimes(1)
    expect(replace).toHaveBeenCalledWith('/dashboard/students', { scroll: false })
  })

  it('falls back to the enrollments page when no caller page is given', () => {
    replace.mockClear()
    render(
      <CreateEnrollmentDialog
        students={students}
        plans={plans}
        classes={classes}
        paymentsEnabled={true}
        defaultOpen
      />
    )

    expect(replace).toHaveBeenCalledTimes(1)
    expect(replace).toHaveBeenCalledWith('/dashboard/enrollments', { scroll: false })
  })
})
