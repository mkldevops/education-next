import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CreateStudentDialog } from './create-student-dialog'

const { createStudentAction } = vi.hoisted(() => ({
  createStudentAction: vi
    .fn()
    .mockResolvedValue({ studentId: 'student-1', enrollmentId: 'enrollment-1' }),
}))

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
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
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'title' }))
    fireEvent.change(screen.getByLabelText('firstname'), { target: { value: 'Alice' } })
    fireEvent.change(screen.getByLabelText('lastname'), { target: { value: 'Martin' } })
    fireEvent.click(screen.getByRole('combobox', { name: 'selectPlan' }))
    const reducedPlan = await screen.findByRole('option', { name: 'Plan réduit' })
    fireEvent.pointerDown(reducedPlan)
    fireEvent.click(reducedPlan)

    expect(screen.getByLabelText('totalAmount')).toHaveValue(120)

    fireEvent.submit(screen.getByLabelText('firstname').closest('form') as HTMLFormElement)

    await waitFor(() => {
      expect(createStudentAction).toHaveBeenCalledWith(
        expect.objectContaining({
          enrollment: expect.objectContaining({
            planId: '550e8400-e29b-41d4-a716-446655440003',
            totalAmount: 120,
          }),
        })
      )
    })
  })
})
