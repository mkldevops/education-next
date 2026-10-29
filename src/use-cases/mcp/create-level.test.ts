import { describe, expect, it, vi } from 'vitest'
import { createLevelFromMcp } from './create-level'

const scope = { schoolId: 'school-1' }

describe('createLevelFromMcp', () => {
  it('normalizes a level name and always takes the school from the scope', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'level-1', name: 'CP', schoolId: 'school-1' })
    const input = { name: ' CP ', schoolId: 'other-school' }

    expect(await createLevelFromMcp(scope, input, create)).toEqual({ id: 'level-1', name: 'CP' })
    expect(create).toHaveBeenCalledWith({ name: 'CP', schoolId: 'school-1' })
  })

  it.each(['', '   ', 'a'.repeat(251)])('rejects an invalid name without writing', async (name) => {
    const create = vi.fn()
    expect(await createLevelFromMcp(scope, { name }, create)).toBe('validationError')
    expect(create).not.toHaveBeenCalled()
  })

  it('preserves the duplicate refusal instead of returning a resource', async () => {
    const create = vi.fn().mockResolvedValue('nameTaken')
    expect(await createLevelFromMcp(scope, { name: 'CP' }, create)).toBe('nameTaken')
  })
})
