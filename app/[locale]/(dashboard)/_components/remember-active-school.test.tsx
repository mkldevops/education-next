import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/actions/school-actions', () => ({
  rememberActiveSchoolAction: vi.fn().mockResolvedValue('OK'),
}))

import { rememberActiveSchoolAction } from '@/actions/school-actions'
import { RememberActiveSchool } from './remember-active-school'

describe('RememberActiveSchool', () => {
  it('remembers the displayed school once, without rendering anything', () => {
    const { container } = render(<RememberActiveSchool />)

    expect(container).toBeEmptyDOMElement()
    expect(rememberActiveSchoolAction).toHaveBeenCalledTimes(1)
  })
})
