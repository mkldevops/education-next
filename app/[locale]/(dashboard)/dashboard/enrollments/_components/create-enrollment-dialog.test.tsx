import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CreateEnrollmentDialog } from './create-enrollment-dialog'

const { replace, createEnrollmentAction } = vi.hoisted(() => ({
  replace: vi.fn(),
  createEnrollmentAction: vi.fn(),
}))
vi.mock('next-intl', () => ({
  useLocale: () => 'fr',
  useTranslations: () => (key: string) => key,
}))
vi.mock('@/i18n/routing', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace }),
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))
// Action serveur réelle : exigerait une session et une base, hors de portée d'un test de
// rendu pur qui ne soumet jamais le formulaire.
vi.mock('../../../_lib/enrollment-actions', () => ({ createEnrollmentAction }))

const students = [{ id: 'student-1', name: 'Alice Martin' }]
const plans = [{ id: 'plan-1', name: 'Tarif annuel' }]
const classes = [{ id: 'class-1', name: 'CE1' }]

// Le formulaire est chargé à l'ouverture : attendre qu'il remplace le panneau d'attente.
async function openDialog() {
  fireEvent.click(screen.getByRole('button', { name: 'title' }))
  await screen.findByRole('button', { name: 'cancel' })
}

describe('CreateEnrollmentDialog with payments enabled', () => {
  it('shows the plan selector and the amount due field', async () => {
    render(
      <CreateEnrollmentDialog
        students={students}
        plans={plans}
        classes={classes}
        paymentsEnabled={true}
        currency="EUR"
      />
    )
    await openDialog()

    expect(screen.getByLabelText(/^selectPlan/)).toBeInTheDocument()
    expect(screen.getByLabelText('totalAmount')).toBeInTheDocument()
    expect(screen.getByLabelText(/^selectClass/)).toBeInTheDocument()
  })
})

describe('CreateEnrollmentDialog student picker', () => {
  it('points to the Students page for a child who does not exist yet', async () => {
    render(
      <CreateEnrollmentDialog
        students={students}
        plans={plans}
        classes={classes}
        paymentsEnabled={true}
        currency="EUR"
      />
    )
    await openDialog()

    expect(screen.getByRole('link', { name: 'newStudentLink' })).toHaveAttribute(
      'href',
      '/dashboard/students'
    )
  })
})

describe('CreateEnrollmentDialog add-student shortcut', () => {
  it('hands over to the student creation flow instead of leaving the page', async () => {
    const onAddStudent = vi.fn()
    render(
      <CreateEnrollmentDialog
        students={students}
        plans={plans}
        classes={classes}
        paymentsEnabled={true}
        currency="EUR"
        onAddStudent={onAddStudent}
      />
    )
    await openDialog()

    expect(screen.queryByRole('link', { name: 'newStudentLink' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'newStudentLink' }))

    expect(onAddStudent).toHaveBeenCalledOnce()
  })
})

describe('CreateEnrollmentDialog with payments disabled', () => {
  it('hides the plan selector and the amount due field, keeping the class selector', async () => {
    render(
      <CreateEnrollmentDialog
        students={students}
        plans={plans}
        classes={classes}
        paymentsEnabled={false}
        currency="EUR"
      />
    )
    await openDialog()

    expect(screen.queryByLabelText(/^selectPlan/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText('totalAmount')).not.toBeInTheDocument()
    expect(screen.getByLabelText(/^selectClass/)).toBeInTheDocument()
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
        currency="EUR"
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
        currency="EUR"
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

  async function renderGuided() {
    render(
      <CreateEnrollmentDialog
        students={guidedStudents}
        plans={plans}
        classes={guidedClasses}
        paymentsEnabled={false}
        currency="EUR"
      />
    )
    await openDialog()
  }

  function searchStudent(query: string) {
    fireEvent.click(screen.getByRole('button', { name: 'open' }))
    fireEvent.change(screen.getByLabelText(/^selectStudent/), { target: { value: query } })
  }

  async function pickStudent(query: string, name: RegExp) {
    searchStudent(query)
    fireEvent.click(await screen.findByRole('option', { name }))
  }

  it('preselects neither a student nor a class and blocks submission', async () => {
    await renderGuided()

    expect(screen.getByLabelText(/^selectStudent/)).toHaveValue('')
    expect(screen.getByRole('combobox', { name: 'selectClass' })).toHaveTextContent('placeholder')
    expect(screen.getByRole('button', { name: 'submit' })).toBeDisabled()
    expect(screen.getByText(/^missingFields/)).toBeInTheDocument()
  })

  it('filters students by family name and flags those already enrolled', async () => {
    await renderGuided()

    searchStudent('haddad')

    const option = await screen.findByRole('option', { name: /Bilal Haddad/ })
    expect(option).toHaveTextContent('alreadyEnrolled')
    expect(screen.queryByRole('option', { name: /Alice Martin/ })).not.toBeInTheDocument()
  })

  it('lists the suggested level first, with remaining seats and full classes flagged', async () => {
    await renderGuided()
    await pickStudent('alice', /Alice Martin/)

    fireEvent.click(screen.getByRole('combobox', { name: 'selectClass' }))
    const options = await screen.findAllByRole('option')
    expect(options.map((o) => o.textContent)).toEqual([
      expect.stringContaining('CE2-A'),
      expect.stringContaining('CE1-A'),
    ])
    expect(screen.queryByRole('checkbox', { name: /replaceExisting/ })).not.toBeInTheDocument()
    expect(options[0]).toHaveTextContent('seats')
    expect(options[1]).toHaveTextContent('full')
    fireEvent.pointerDown(options[0])
    fireEvent.click(options[0])

    expect(screen.getByRole('button', { name: 'submit' })).toBeEnabled()
    expect(screen.queryByText(/^missingFields/)).not.toBeInTheDocument()
  })

  it('requires replacing the existing enrollment of an already enrolled student', async () => {
    await renderGuided()
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

describe('CreateEnrollmentDialog arrival during the year', () => {
  const monthlyPlans = [
    {
      id: 'plan-1',
      name: 'Mensuel',
      amount: 1000,
      paymentSchedule: { mode: 'MONTHLY' as const, firstMonth: 9, count: 10, dueDay: 5 },
    },
  ]
  const periodClasses = [
    {
      id: 'class-1',
      name: 'CE1',
      periodStartAt: '2026-09-01T00:00:00.000Z',
      periodEndAt: '2027-06-30T00:00:00.000Z',
    },
  ]

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 20, 10))
    createEnrollmentAction.mockReset().mockResolvedValue({ id: 'enrollment-1' })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  async function choose(combobox: string, option: RegExp) {
    fireEvent.click(screen.getByRole('combobox', { name: combobox }))
    const item = await screen.findByRole('option', { name: option })
    fireEvent.pointerDown(item)
    fireEvent.click(item)
  }

  it('shows the first month to pay unfolded and sends it with the amount of that month', async () => {
    render(
      <CreateEnrollmentDialog
        students={students}
        plans={monthlyPlans}
        classes={periodClasses}
        paymentsEnabled={true}
        currency="EUR"
        defaultStudentId="student-1"
      />
    )
    await openDialog()

    const section = screen.getByRole('group', { name: 'title' })
    expect(section.closest('details')).toBeNull()
    expect(screen.getByLabelText('totalAmount')).toHaveValue(1000)

    await choose('startMonth', /Novembre 2026/)
    expect(screen.getByLabelText('totalAmount')).toHaveValue(800)
    fireEvent.click(within(section).getByRole('button', { name: 'half' }))
    expect(screen.getByLabelText('totalAmount')).toHaveValue(750)

    await choose('selectClass', /CE1/)
    fireEvent.click(screen.getByRole('button', { name: 'submit' }))

    await waitFor(() =>
      expect(createEnrollmentAction).toHaveBeenCalledWith(
        expect.objectContaining({
          studentId: 'student-1',
          planId: 'plan-1',
          classPeriodId: 'class-1',
          totalAmount: 750,
          startMonth: '2026-11',
          firstInstallmentAmount: 50,
        })
      )
    )
  })

  it('offers no arrival section when plans carry no price, as for a non-admin', async () => {
    render(
      <CreateEnrollmentDialog
        students={students}
        plans={[]}
        classes={periodClasses}
        paymentsEnabled={false}
        currency="EUR"
        defaultStudentId="student-1"
      />
    )
    await openDialog()

    expect(screen.queryByText('title', { selector: 'legend, summary' })).not.toBeInTheDocument()
    await choose('selectClass', /CE1/)
    fireEvent.click(screen.getByRole('button', { name: 'submit' }))

    await waitFor(() =>
      expect(createEnrollmentAction).toHaveBeenCalledWith(
        expect.objectContaining({ startMonth: null, firstInstallmentAmount: null })
      )
    )
  })
})
