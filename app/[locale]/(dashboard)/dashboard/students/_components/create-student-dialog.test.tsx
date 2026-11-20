import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CreateStudentDialog } from './create-student-dialog'

const { createStudentAction } = vi.hoisted(() => ({
  createStudentAction: vi
    .fn()
    .mockResolvedValue({ studentId: 'student-1', enrollmentId: 'enrollment-1' }),
}))

vi.mock('next-intl', () => ({
  useLocale: () => 'fr',
  useTranslations: () => (key: string) => key,
}))
vi.mock('@/i18n/routing', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('../../../_lib/student-actions', () => ({ createStudentAction }))

describe('CreateStudentDialog', () => {
  it('resynchronizes the amount due with the selected plan and submits both values', async () => {
    render(
      <CreateStudentDialog
        familyId="550e8400-e29b-41d4-a716-446655440001"
        plans={[
          { id: '550e8400-e29b-41d4-a716-446655440002', name: 'Plan standard', amount: 300 },
          { id: '550e8400-e29b-41d4-a716-446655440003', name: 'Plan réduit', amount: 120 },
        ]}
        classes={[{ id: '550e8400-e29b-41d4-a716-446655440004', name: 'CE1' }]}
        paymentsEnabled={true}
        currency="EUR"
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'title' }))
    await screen.findByLabelText(/^firstname/)
    fireEvent.change(screen.getByLabelText(/^firstname/), { target: { value: 'Alice' } })
    fireEvent.change(screen.getByLabelText(/^lastname/), { target: { value: 'Martin' } })
    fireEvent.click(screen.getByRole('combobox', { name: 'selectPlan' }))
    const reducedPlan = await screen.findByRole('option', { name: 'Plan réduit' })
    fireEvent.pointerDown(reducedPlan)
    fireEvent.click(reducedPlan)

    expect(screen.getByLabelText('totalAmount')).toHaveValue(120)

    // Aucune classe présélectionnée : la validation attend un choix explicite.
    expect(screen.getByRole('button', { name: 'submit' })).toBeDisabled()
    fireEvent.click(screen.getByRole('combobox', { name: 'selectClass' }))
    const ce1 = await screen.findByRole('option', { name: /CE1/ })
    fireEvent.pointerDown(ce1)
    fireEvent.click(ce1)
    expect(screen.getByRole('button', { name: 'submit' })).toBeEnabled()

    fireEvent.submit(screen.getByLabelText(/^firstname/).closest('form') as HTMLFormElement)

    await waitFor(() => {
      expect(createStudentAction).toHaveBeenCalledWith(
        expect.objectContaining({
          enrollment: expect.objectContaining({
            planId: '550e8400-e29b-41d4-a716-446655440003',
            totalAmount: 120,
            classPeriodId: '550e8400-e29b-41d4-a716-446655440004',
          }),
        })
      )
    })
  })

  it('prefills the last name with the family name and marks the required fields', async () => {
    render(
      <CreateStudentDialog
        familyId="550e8400-e29b-41d4-a716-446655440001"
        familyName="Martin"
        classes={[{ id: '550e8400-e29b-41d4-a716-446655440004', name: 'CE1' }]}
        paymentsEnabled={false}
        currency="EUR"
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'title' }))
    await screen.findByLabelText(/^firstname/)

    const lastname = screen.getByLabelText(/^lastname/)
    expect(lastname).toHaveValue('Martin')
    fireEvent.change(lastname, { target: { value: 'Martin-Durand' } })
    expect(lastname).toHaveValue('Martin-Durand')

    for (const label of ['firstname', 'lastname', 'selectClass']) {
      expect(screen.getByText(label).closest('label')).toHaveTextContent(`${label} *`)
    }
    expect(screen.getByText('sex').closest('label')).toHaveTextContent(/^sex$/)
  })

  it('folds health fields into a collapsed section and still submits them', async () => {
    createStudentAction.mockClear()
    render(
      <CreateStudentDialog
        familyId="550e8400-e29b-41d4-a716-446655440001"
        familyName="Martin"
        paymentsEnabled={false}
        currency="EUR"
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'title' }))
    await screen.findByLabelText(/^firstname/)

    const section = screen.getByText('healthSection').closest('details') as HTMLDetailsElement
    expect(section.open).toBe(false)
    expect(section).toContainElement(screen.getByLabelText('allergies'))
    expect(section).toContainElement(screen.getByLabelText('healthNotes'))
    expect(section).toContainElement(screen.getByLabelText('snackAuthorization'))

    fireEvent.change(screen.getByLabelText(/^firstname/), { target: { value: 'Alice' } })
    fireEvent.change(screen.getByLabelText('allergies'), { target: { value: 'Arachides' } })
    fireEvent.submit(screen.getByLabelText(/^firstname/).closest('form') as HTMLFormElement)

    await waitFor(() => {
      expect(createStudentAction).toHaveBeenCalledWith(
        expect.objectContaining({
          person: expect.objectContaining({ name: 'Alice', lastname: 'Martin' }),
          student: expect.objectContaining({ allergies: 'Arachides' }),
        })
      )
    })
  })

  describe('arrival during the year', () => {
    afterEach(() => {
      vi.useRealTimers()
    })

    it('sends the first month to pay and the amount of that month with the enrollment', async () => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date(2026, 10, 20, 10))
      createStudentAction.mockClear()
      render(
        <CreateStudentDialog
          familyId="550e8400-e29b-41d4-a716-446655440001"
          familyName="Martin"
          plans={[
            {
              id: '550e8400-e29b-41d4-a716-446655440002',
              name: 'Plan mensuel',
              amount: 1000,
              paymentSchedule: { mode: 'MONTHLY', firstMonth: 9, count: 10, dueDay: 5 },
            },
          ]}
          classes={[
            {
              id: '550e8400-e29b-41d4-a716-446655440004',
              name: 'CE1',
              periodStartAt: '2026-09-01T00:00:00.000Z',
              periodEndAt: '2027-06-30T00:00:00.000Z',
            },
          ]}
          paymentsEnabled={true}
          currency="EUR"
        />
      )
      fireEvent.click(screen.getByRole('button', { name: 'title' }))
      await screen.findByLabelText(/^firstname/)
      fireEvent.change(screen.getByLabelText(/^firstname/), { target: { value: 'Alice' } })

      for (const [combobox, option] of [
        ['selectClass', /CE1/],
        ['startMonth', /Avril 2027/],
      ] as const) {
        fireEvent.click(screen.getByRole('combobox', { name: combobox }))
        const item = await screen.findByRole('option', { name: option })
        fireEvent.pointerDown(item)
        fireEvent.click(item)
      }
      expect(screen.getByRole('group', { name: 'title' }).closest('details')).toBeNull()
      fireEvent.change(screen.getByLabelText('firstAmount'), { target: { value: '40' } })
      expect(screen.getByLabelText('totalAmount')).toHaveValue(240)

      fireEvent.submit(screen.getByLabelText(/^firstname/).closest('form') as HTMLFormElement)

      await waitFor(() => {
        expect(createStudentAction).toHaveBeenCalledWith(
          expect.objectContaining({
            enrollment: expect.objectContaining({
              totalAmount: 240,
              startMonth: '2027-04',
              firstInstallmentAmount: 40,
            }),
          })
        )
      })
    })
  })
})
