import { describe, expect, it, vi } from 'vitest'
import type { configGateway } from '@/gateways/config-gateway'
import { isTeacherExpensesEnabled } from './is-teacher-expenses-enabled'

const reading = (value: string | null) =>
  ({
    get: vi.fn(async () => (value === null ? null : { name: 'teacher_expenses_enabled', value })),
  }) as unknown as typeof configGateway

describe('isTeacherExpensesEnabled', () => {
  it('is disabled when the school holds no setting, unlike payments', async () => {
    await expect(isTeacherExpensesEnabled('school-1', reading(null))).resolves.toBe(false)
  })

  it('is enabled only on an explicit opt-in', async () => {
    await expect(isTeacherExpensesEnabled('school-1', reading('true'))).resolves.toBe(true)
    await expect(isTeacherExpensesEnabled('school-1', reading('false'))).resolves.toBe(false)
  })

  it('keeps an unreadable value disabled rather than opening the feature', async () => {
    await expect(isTeacherExpensesEnabled('school-1', reading('nope'))).resolves.toBe(false)
  })

  it('reads the setting scoped to the school it was asked about', async () => {
    const configGw = reading('true')

    await isTeacherExpensesEnabled('school-2', configGw)

    expect(configGw.get).toHaveBeenCalledWith('school-2', 'teacher_expenses_enabled')
  })
})
