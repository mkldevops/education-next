import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CreateFamilyDialog } from './create-family-dialog'

const { createFamilyAction, push, toastError } = vi.hoisted(() => ({
  createFamilyAction: vi.fn(),
  push: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
vi.mock('@/i18n/routing', () => ({ useRouter: () => ({ push, replace: vi.fn() }) }))
vi.mock('../../../_lib/family-actions', () => ({ createFamilyAction }))
vi.mock('@/lib/toast', () => ({
  toast: { error: toastError, success: vi.fn() },
  toastActionError: vi.fn(),
}))

const planId = '550e8400-e29b-41d4-a716-446655440002'
const classPeriodId = '550e8400-e29b-41d4-a716-446655440004'
const fullClassId = '550e8400-e29b-41d4-a716-446655440005'
const classes = [
  { id: classPeriodId, name: 'CE1-A', levelId: 'ce1', levelName: 'CE1', capacity: 18, enrolled: 3 },
  { id: fullClassId, name: 'CP-A', levelId: 'cp', levelName: 'CP', capacity: 18, enrolled: 18 },
]

const chooseClass = async (name: RegExp) => {
  fireEvent.click(screen.getByRole('combobox', { name: /selectClass/ }))
  const option = await screen.findByRole('option', { name })
  fireEvent.pointerDown(option)
  fireEvent.click(option)
}

/** Ouvre le dialog, nomme la famille et ajoute un enfant inscrit (case cochée par défaut). */
const openWithChild = async () => {
  render(
    <CreateFamilyDialog
      plans={[{ id: planId, name: 'Plan standard', amount: 300 }]}
      classes={classes}
      paymentsEnabled={true}
    />
  )
  fireEvent.click(screen.getByRole('button', { name: 'title' }))
  fireEvent.change(screen.getByLabelText(/^name/), { target: { value: 'Martin' } })
  submit()
  fireEvent.click(await screen.findByRole('button', { name: 'addChild' }))
  fireEvent.change(screen.getByLabelText('firstname'), { target: { value: 'Adam' } })
}

const submit = () =>
  fireEvent.submit(
    screen.getByRole('button', { name: /next|submit/ }).closest('form') as HTMLFormElement
  )

describe('CreateFamilyDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createFamilyAction.mockResolvedValue({ id: 'family-1', studentIds: [], enrollmentIds: [] })
  })

  it('keeps the minimal flow: a family name only', async () => {
    render(<CreateFamilyDialog />)
    fireEvent.click(screen.getByRole('button', { name: 'title' }))

    fireEvent.change(screen.getByLabelText(/^name/), { target: { value: 'Martin' } })
    submit()
    await screen.findByText('noChildren')
    submit()
    await screen.findByText('Martin')
    submit()

    await waitFor(() =>
      expect(createFamilyAction).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Martin', parents: [], students: [] })
      )
    )
    await waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard/families/family-1'))
  })

  it('prefills the family from the guardian and enrolls a child', async () => {
    render(
      <CreateFamilyDialog
        plans={[{ id: planId, name: 'Plan standard', amount: 300 }]}
        classes={classes}
        paymentsEnabled={true}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'title' }))

    fireEvent.change(screen.getAllByLabelText('firstname')[0], { target: { value: 'Jean' } })
    fireEvent.change(screen.getAllByLabelText('lastname')[0], { target: { value: 'Dupont' } })
    fireEvent.change(screen.getByLabelText('phone'), { target: { value: '0612345678' } })

    expect(screen.getByLabelText(/^name/)).toHaveValue('Dupont')
    expect(screen.getByLabelText('emergencyContactName')).toHaveValue('Jean Dupont')
    expect(screen.getByLabelText('emergencyContactPhone')).toHaveValue('0612345678')

    submit()
    fireEvent.click(await screen.findByRole('button', { name: 'addChild' }))
    expect(screen.getByLabelText('lastname')).toHaveValue('Dupont')
    fireEvent.change(screen.getByLabelText('firstname'), { target: { value: 'Laylah' } })
    await chooseClass(/CE1-A/)
    submit()
    await screen.findByText(/Laylah Dupont/)
    submit()

    await waitFor(() =>
      expect(createFamilyAction).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Dupont',
          emergencyContactName: 'Jean Dupont',
          emergencyContactPhone: '0612345678',
          parents: [expect.objectContaining({ name: 'Jean', lastname: 'Dupont' })],
          students: [
            expect.objectContaining({
              person: expect.objectContaining({ name: 'Laylah', lastname: 'Dupont' }),
              enrollment: expect.objectContaining({ planId, classPeriodId }),
            }),
          ],
        })
      )
    )
  })

  it('creates a child without enrollment when no class is available', async () => {
    render(<CreateFamilyDialog paymentsEnabled={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'title' }))

    fireEvent.change(screen.getByLabelText(/^name/), { target: { value: 'Martin' } })
    submit()
    fireEvent.click(await screen.findByRole('button', { name: 'addChild' }))
    fireEvent.change(screen.getByLabelText('firstname'), { target: { value: 'Adam' } })
    fireEvent.change(screen.getByLabelText('lastname'), { target: { value: 'Martin' } })
    submit()
    await screen.findByText(/Adam Martin/)
    submit()

    await waitFor(() => expect(createFamilyAction).toHaveBeenCalled())
    const [payload] = createFamilyAction.mock.calls[0]
    expect(payload.students[0]).not.toHaveProperty('enrollment')
  })

  it('preselects no class and blocks the step until one is chosen', async () => {
    await openWithChild()

    expect(screen.getByRole('combobox', { name: /selectClass/ })).toHaveTextContent('placeholder')
    submit()
    expect(toastError).toHaveBeenCalledWith('classRequired')
    expect(screen.queryByText(/Adam Martin/)).not.toBeInTheDocument()

    await chooseClass(/CE1-A/)
    submit()
    await screen.findByText(/Adam Martin — Plan standard, CE1-A/)
  })

  it('groups classes by level and keeps a full class selectable', async () => {
    await openWithChild()

    fireEvent.click(screen.getByRole('combobox', { name: /selectClass/ }))
    expect(await screen.findByRole('group', { name: 'CE1' })).toHaveTextContent('CE1-A')
    expect(screen.getByRole('group', { name: 'CP' })).toHaveTextContent('CP-A')
    const full = await screen.findByRole('option', { name: /CP-A.*full/ })
    fireEvent.pointerDown(full)
    fireEvent.click(full)
    submit()
    await screen.findByText(/Adam Martin — Plan standard, CP-A/)
    submit()

    await waitFor(() =>
      expect(createFamilyAction).toHaveBeenCalledWith(
        expect.objectContaining({
          students: [
            expect.objectContaining({
              enrollment: expect.objectContaining({ planId, classPeriodId: fullClassId }),
            }),
          ],
        })
      )
    )
  })
})
