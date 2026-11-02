import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { McpOAuthGrantView } from '../_lib/mcp-oauth-grant-view'

const toastError = vi.fn()
const toastSuccess = vi.fn()
const revokeMcpOAuthGrantAction = vi.fn()

const KNOWN_ERROR_KEYS: Record<string, true> = {
  'errors.notFound': true,
  'errors.impersonating': true,
}

vi.mock('next-intl', () => ({
  useTranslations: () => {
    const t = (key: string, values?: Record<string, unknown>) =>
      values?.name ? `${key}:${values.name}` : key
    t.has = (key: string) => KNOWN_ERROR_KEYS[key] === true
    return t
  },
  useLocale: () => 'fr',
}))

vi.mock('@/i18n/routing', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

vi.mock('@/lib/toast', () => ({
  toast: {
    error: (message: string) => toastError(message),
    success: (message: string) => toastSuccess(message),
  },
}))

vi.mock('../_lib/mcp-oauth-grant-actions', () => ({
  revokeMcpOAuthGrantAction: (id: string) => revokeMcpOAuthGrantAction(id),
}))

import { ConnectedAppsSection } from './connected-apps-section'

let nextId = 0

function connection(overrides: Partial<McpOAuthGrantView> = {}): McpOAuthGrantView {
  nextId += 1
  return {
    id: `grant-${nextId}`,
    clientName: 'ChatGPT',
    lastUsedAt: null,
    revokedAt: null,
    createdAt: '2026-09-01T12:00:00Z',
    ...overrides,
  }
}

describe('ConnectedAppsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    revokeMcpOAuthGrantAction.mockResolvedValue('OK')
  })

  it('shows the ChatGPT setup with the MCP URL of this site, key-less', () => {
    render(<ConnectedAppsSection connections={[]} />)

    expect(screen.getByText('empty')).toBeInTheDocument()
    expect(screen.getByText('setup.title')).toBeInTheDocument()
    const setup = screen.getByText('setup.title').closest('details') as HTMLElement
    expect(within(setup).getByText(`${window.location.origin}/api/mcp`)).toBeInTheDocument()
    expect(screen.queryByText(/edu_mcp_/)).not.toBeInTheDocument()
  })

  it('lists live connections with a revoke button and revoked ones without', () => {
    render(
      <ConnectedAppsSection
        connections={[
          connection({ clientName: 'ChatGPT', lastUsedAt: '2026-09-02T08:00:00Z' }),
          connection({ clientName: 'Inspector', revokedAt: '2026-09-03T08:00:00Z' }),
        ]}
      />
    )

    expect(screen.getByText('ChatGPT')).toBeInTheDocument()
    expect(screen.getByText('Inspector')).toBeInTheDocument()
    expect(screen.getByText('revokedLabel')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^revoke:/ })).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'revoke:ChatGPT' })).toBeInTheDocument()
  })

  it('revokes after confirmation and marks the row as revoked', async () => {
    const row = connection()
    render(<ConnectedAppsSection connections={[row]} />)

    fireEvent.click(screen.getByRole('button', { name: 'revoke:ChatGPT' }))
    fireEvent.click(await screen.findByRole('button', { name: 'revokeDialog.confirm' }))

    await waitFor(() => expect(revokeMcpOAuthGrantAction).toHaveBeenCalledWith(row.id))
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('revoked'))
    expect(screen.getByText('revokedLabel')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'revoke:ChatGPT' })).not.toBeInTheDocument()
  })

  it('keeps the row live and names the refusal when the action fails', async () => {
    revokeMcpOAuthGrantAction.mockResolvedValue('impersonating')
    render(<ConnectedAppsSection connections={[connection()]} />)

    fireEvent.click(screen.getByRole('button', { name: 'revoke:ChatGPT' }))
    fireEvent.click(await screen.findByRole('button', { name: 'revokeDialog.confirm' }))

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('errors.impersonating'))
    expect(screen.getByRole('button', { name: 'revoke:ChatGPT' })).toBeInTheDocument()
    expect(screen.queryByText('revokedLabel')).not.toBeInTheDocument()
  })

  it('falls back to the generic error for an unmapped refusal', async () => {
    revokeMcpOAuthGrantAction.mockResolvedValue('unexpected')
    render(<ConnectedAppsSection connections={[connection()]} />)

    fireEvent.click(screen.getByRole('button', { name: 'revoke:ChatGPT' }))
    fireEvent.click(await screen.findByRole('button', { name: 'revokeDialog.confirm' }))

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('error'))
  })
})
