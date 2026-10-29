import { describe, expect, it, vi } from 'vitest'
import { createClassPeriodFromMcp } from './create-class-period'

const scope = { schoolId: 'school-1' }
const input = {
  name: ' CP ',
  capacity: 30,
  levelId: '00000000-0000-4000-8000-000000000001',
  periodId: '00000000-0000-4000-8000-000000000002',
}

describe('createClassPeriodFromMcp', () => {
  it('uses only the scoped school, with no teachers by default', async () => {
    const create = vi
      .fn()
      .mockResolvedValue({ ...input, id: 'class-1', name: 'CP', schoolId: 'school-1' })
    const result = await createClassPeriodFromMcp(
      scope,
      { ...input, schoolId: 'other-school' } as typeof input,
      create
    )

    expect(create).toHaveBeenCalledWith({
      ...input,
      name: 'CP',
      teacherIds: [],
      schoolId: 'school-1',
    })
    expect(result).toEqual({ ...input, id: 'class-1', name: 'CP' })
  })

  it.each([
    { name: '   ' },
    { capacity: 0 },
    { capacity: 1.5 },
    { levelId: 'invalid' },
    { periodId: 'invalid' },
    {
      teacherIds: ['00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000003'],
    },
  ])('rejects invalid class input without writing: %j', async (invalid) => {
    const create = vi.fn()
    expect(await createClassPeriodFromMcp(scope, { ...input, ...invalid }, create)).toBe(
      'validationError'
    )
    expect(create).not.toHaveBeenCalled()
  })

  it.each(['levelNotFound', 'periodNotFound', 'levelAlreadyAssigned', 'teacherNotFound'])(
    'preserves the dashboard refusal %s',
    async (refusal) => {
      const create = vi.fn().mockResolvedValue(refusal)
      expect(await createClassPeriodFromMcp(scope, input, create)).toBe(refusal)
    }
  )

  it('passes explicit teachers to the existing school-scoped validation', async () => {
    const create = vi.fn().mockResolvedValue('teacherNotFound')
    const teacherIds = ['00000000-0000-4000-8000-000000000003']
    await createClassPeriodFromMcp(scope, { ...input, teacherIds }, create)
    expect(create).toHaveBeenCalledWith({ ...input, name: 'CP', teacherIds, schoolId: 'school-1' })
  })
})
