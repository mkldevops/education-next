import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('@/i18n/routing', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/services/search-service', () => ({
  searchStudentsAndFamilies: vi.fn(),
}))

import { searchStudentsAndFamilies } from '@/services/search-service'
import { SearchModal } from '../search-modal'

const search = () => screen.getByPlaceholderText('placeholder')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('SearchModal', () => {
  it('shows a generic error and clears results when the search request rejects', async () => {
    vi.mocked(searchStudentsAndFamilies).mockRejectedValue(new Error('network error'))

    render(<SearchModal />)
    fireEvent.change(search(), { target: { value: 'martin' } })

    await waitFor(() => expect(screen.getByText('errorGeneric')).toBeInTheDocument(), {
      timeout: 2000,
    })
    expect(screen.queryByText('noResults')).not.toBeInTheDocument()
  })

  it('invites re-authentication when the action returns unauthorized', async () => {
    vi.mocked(searchStudentsAndFamilies).mockResolvedValue('unauthorized')

    render(<SearchModal />)
    fireEvent.change(search(), { target: { value: 'martin' } })

    await waitFor(() => expect(screen.getByText('errorUnauthorized')).toBeInTheDocument(), {
      timeout: 2000,
    })
  })

  it('shows a validation error distinct from unauthorized', async () => {
    vi.mocked(searchStudentsAndFamilies).mockResolvedValue('validationError')

    render(<SearchModal />)
    fireEvent.change(search(), { target: { value: 'martin' } })

    await waitFor(() => expect(screen.getByText('errorValidation')).toBeInTheDocument(), {
      timeout: 2000,
    })
    expect(screen.queryByText('errorUnauthorized')).not.toBeInTheDocument()
  })

  it('clears the error once the query changes', async () => {
    vi.mocked(searchStudentsAndFamilies).mockResolvedValue('unauthorized')

    render(<SearchModal />)
    fireEvent.change(search(), { target: { value: 'martin' } })

    await waitFor(() => expect(screen.getByText('errorUnauthorized')).toBeInTheDocument(), {
      timeout: 2000,
    })

    vi.mocked(searchStudentsAndFamilies).mockResolvedValue([])
    fireEvent.change(search(), { target: { value: 'dubois' } })

    expect(screen.queryByText('errorUnauthorized')).not.toBeInTheDocument()
  })

  it('renders results normally when the search succeeds', async () => {
    vi.mocked(searchStudentsAndFamilies).mockResolvedValue([
      { type: 'student', id: '1', name: 'Ali Martin', secondaryInfo: 'Famille Martin' },
    ])

    render(<SearchModal />)
    fireEvent.change(search(), { target: { value: 'martin' } })

    await waitFor(() => expect(screen.getByText('Ali Martin')).toBeInTheDocument(), {
      timeout: 2000,
    })
    expect(screen.queryByText('errorGeneric')).not.toBeInTheDocument()
  })
})
