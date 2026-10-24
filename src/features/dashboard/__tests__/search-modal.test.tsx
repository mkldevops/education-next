import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const pushMock = vi.fn()

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('@/i18n/routing', () => ({
  useRouter: () => ({ push: pushMock }),
}))

vi.mock('@/services/search-service', () => ({
  searchStudentsAndFamilies: vi.fn(),
}))

import { searchStudentsAndFamilies } from '@/services/search-service'
import { SearchModal } from '../search-modal'
import type { NavScope } from '../sidebar-items'
import { useSidebarStore } from '../sidebar-store'

// cmdk mesure sa liste et fait défiler l'élément actif : jsdom n'implémente ni l'un ni l'autre.
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
  Element.prototype.scrollIntoView ??= () => {}
})

const adminScope: NavScope = {
  roles: ['ADMIN'],
  isSuperAdmin: false,
  features: { events: false, payments: true, attendance: true },
}

const search = () => screen.getByPlaceholderText('placeholder')
const selected = () => document.querySelector('[cmdk-item][data-selected="true"]')

beforeEach(() => {
  vi.clearAllMocks()
  useSidebarStore.setState({ navScope: null })
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

  it('groups actions and destinations from the sidebar scope before any query', () => {
    useSidebarStore.setState({ navScope: adminScope })

    render(<SearchModal />)

    expect(screen.getByText('groupActions')).toBeInTheDocument()
    expect(screen.getByText('groupNavigation')).toBeInTheDocument()
    expect(screen.getByText('actions.newFamily')).toBeInTheDocument()
    expect(screen.getByText('actions.takeAttendance')).toBeInTheDocument()
    expect(searchStudentsAndFamilies).not.toHaveBeenCalled()
  })

  it('moves the selection with the arrow keys and opens it with Enter', () => {
    useSidebarStore.setState({ navScope: adminScope })
    const onClose = vi.fn()

    render(<SearchModal onClose={onClose} />)
    const first = selected()
    expect(first).toHaveTextContent('actions.newFamily')

    fireEvent.keyDown(search(), { key: 'ArrowDown' })
    expect(selected()).not.toBe(first)
    expect(selected()).toHaveTextContent('actions.newEnrollment')

    fireEvent.keyDown(search(), { key: 'Enter' })
    expect(pushMock).toHaveBeenCalledWith('/dashboard/enrollments?action=create')
    expect(onClose).toHaveBeenCalled()
  })

  it('traps Tab in the input and closes on Escape', () => {
    const onClose = vi.fn()

    render(<SearchModal onClose={onClose} />)
    const input = search()
    input.blur()

    fireEvent.keyDown(document, { key: 'Tab' })
    expect(input).toHaveFocus()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })
})
