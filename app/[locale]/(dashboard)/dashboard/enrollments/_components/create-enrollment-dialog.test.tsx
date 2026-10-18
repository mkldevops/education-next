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

describe('CreateEnrollmentDialog guided selectors', () => {
  const guidedStudents = [
    {
      id: 'student-1',
      name: 'Alice Martin',
      familyName: 'Famille Martin',
      suggestedLevelId: 'ce2',
    },
    { id: 'student-2', name: 'Bilal Haddad', familyName: 'Famille Haddad', enrolledInPeriod: true },
  ]
  const guidedClasses = [
    { id: 'class-ce1', name: 'CE1-A', levelId: 'ce1', capacity: 18, enrolled: 18 },
    { id: 'class-ce2', name: 'CE2-A', levelId: 'ce2', capacity: 18, enrolled: 16 },
  ]

  function renderGuided() {
    render(
      <CreateEnrollmentDialog
        students={guidedStudents}
        plans={plans}
        classes={guidedClasses}
        paymentsEnabled={false}
      />
    )
    openDialog()
  }

  function searchStudent(query: string) {
    fireEvent.click(screen.getByRole('button', { name: 'open' }))
    fireEvent.change(screen.getByLabelText('selectStudent'), { target: { value: query } })
  }

  async function pickStudent(query: string, name: RegExp) {
    searchStudent(query)
    fireEvent.click(await screen.findByRole('option', { name }))
  }

  it('preselects neither a student nor a class and blocks submission', () => {
    renderGuided()

    expect(screen.getByLabelText('selectStudent')).toHaveValue('')
    expect(screen.getByRole('combobox', { name: 'selectClass' })).toHaveTextContent('placeholder')
    expect(screen.getByRole('button', { name: 'submit' })).toBeDisabled()
  })

  it('filters students by family name and flags those already enrolled', async () => {
    renderGuided()

    searchStudent('haddad')

    const option = await screen.findByRole('option', { name: /Bilal Haddad/ })
    expect(option).toHaveTextContent('alreadyEnrolled')
    expect(screen.queryByRole('option', { name: /Alice Martin/ })).not.toBeInTheDocument()
  })

  it('lists the suggested level first, with remaining seats and full classes flagged', async () => {
    renderGuided()
    await pickStudent('alice', /Alice Martin/)

    fireEvent.click(screen.getByRole('combobox', { name: 'selectClass' }))
    const options = await screen.findAllByRole('option')
    expect(options.map((o) => o.textContent)).toEqual([
      expect.stringContaining('CE2-A'),
      expect.stringContaining('CE1-A'),
    ])
    expect(options[0]).toHaveTextContent('seats')
    expect(options[1]).toHaveTextContent('full')
    fireEvent.pointerDown(options[0])
    fireEvent.click(options[0])

    expect(screen.getByRole('button', { name: 'submit' })).toBeEnabled()
  })

  it('requires replacing the existing enrollment of an already enrolled student', async () => {
    renderGuided()
    await pickStudent('bilal', /Bilal Haddad/)

    fireEvent.click(screen.getByRole('combobox', { name: 'selectClass' }))
    const ce2 = await screen.findByRole('option', { name: /CE2-A/ })
    fireEvent.pointerDown(ce2)
    fireEvent.click(ce2)

    expect(screen.getByText('alreadyEnrolledHint')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'submit' })).toBeDisabled()

    fireEvent.click(screen.getByRole('checkbox', { name: /replaceExisting/ }))
    expect(screen.getByRole('button', { name: 'submit' })).toBeEnabled()
  })
})
