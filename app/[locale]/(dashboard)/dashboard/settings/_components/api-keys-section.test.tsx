import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MCP_KEY_MAX_PER_USER } from '@/domain/mcp-key'
import type { McpApiKeyView } from '../_lib/mcp-api-key-view'

const toastError = vi.fn()
const toastSuccess = vi.fn()
const createMcpApiKeyAction = vi.fn()
const revokeMcpApiKeyAction = vi.fn()

// Traduit chaque clé littéralement, sauf `.has` : ne connaît que les trois refus
// mappés dans `messages/*.json` (`errors.tooManyKeys`, `.validationError`, `.mcpDisabled`),
// pour distinguer le branchement `t.has` (`:60`) d'un mock qui répondrait toujours vrai.
const KNOWN_ERROR_KEYS: Record<string, true> = {
  'errors.tooManyKeys': true,
  'errors.validationError': true,
  'errors.mcpDisabled': true,
}

vi.mock('next-intl', () => ({
  useTranslations: () => {
    const t = (key: string) => key
    t.has = (key: string) => KNOWN_ERROR_KEYS[key] === true
    return t
  },
  useLocale: () => 'fr',
}))

// Le baril `@peaklab/ui` (Breadcrumbs) importe `Link` depuis `@/i18n/routing`, qui
// appelle `next-intl/navigation` — non résoluble par Node hors du bundler Next. Rien
// ici ne dépend de la navigation localisée elle-même.
vi.mock('@/i18n/routing', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

vi.mock('@/lib/toast', () => ({
  toast: {
    error: (message: string) => toastError(message),
    success: (message: string) => toastSuccess(message),
  },
}))

vi.mock('../_lib/mcp-api-key-actions', () => ({
  createMcpApiKeyAction: (input: unknown) => createMcpApiKeyAction(input),
  revokeMcpApiKeyAction: (id: string) => revokeMcpApiKeyAction(id),
}))

import { ApiKeysSection } from './api-keys-section'

// Assez loin dans chaque sens pour ne jamais recouper l'horloge réelle du test.
const FAR_FUTURE = '2999-01-01T00:00:00Z'
const FAR_PAST = '2000-01-01T00:00:00Z'

let nextId = 0

function keyRow(overrides: Partial<McpApiKeyView> = {}): McpApiKeyView {
  nextId += 1
  return {
    id: `key-${nextId}`,
    name: 'Poste de Fatima',
    prefix: 'edu_mcp_aaaa',
    lastUsedAt: null,
    expiresAt: FAR_FUTURE,
    revokedAt: null,
    createdAt: '2026-09-01T12:00:00Z',
    ...overrides,
  }
}

describe('ApiKeysSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('capacity filter', () => {
    it('disables creation once five keys are live, ignoring revoked or expired ones', () => {
      const keys = [
        ...Array.from({ length: MCP_KEY_MAX_PER_USER }, () => keyRow()),
        keyRow({ revokedAt: '2026-01-01T00:00:00Z' }),
        keyRow({ expiresAt: FAR_PAST }),
      ]

      render(<ApiKeysSection keys={keys} />)

      expect(screen.getByRole('button', { name: 'create' })).toBeDisabled()
      expect(screen.getByLabelText('nameLabel')).toBeDisabled()
      expect(screen.getByText('atCapacity')).toBeInTheDocument()
    })

    it('keeps creation open when revoked or expired keys push the total past the cap', () => {
      // Sept lignes au total, au-dessus du seuil de cinq : seul un filtre sur les clés
      // vivantes (pas `rows.length`) doit lire ce compte comme sous la limite.
      const keys = [
        ...Array.from({ length: MCP_KEY_MAX_PER_USER - 2 }, () => keyRow()),
        keyRow({ revokedAt: '2026-01-01T00:00:00Z' }),
        keyRow({ revokedAt: '2026-01-01T00:00:00Z' }),
        keyRow({ expiresAt: FAR_PAST }),
        keyRow({ expiresAt: FAR_PAST }),
      ]

      render(<ApiKeysSection keys={keys} />)

      expect(screen.getByRole('button', { name: 'create' })).toBeEnabled()
      expect(screen.getByLabelText('nameLabel')).toBeEnabled()
      expect(screen.queryByText('atCapacity')).not.toBeInTheDocument()
    })
  })

  describe('revoke confirmation', () => {
    it('opens a dialog naming the key instead of revoking immediately', () => {
      const key = keyRow()

      render(<ApiKeysSection keys={[key]} />)

      fireEvent.click(screen.getByRole('button', { name: 'list.revoke' }))

      const dialog = screen.getByRole('dialog')
      expect(within(dialog).getByText('revokeDialog.title')).toBeInTheDocument()
      expect(within(dialog).getByText(key.name)).toBeInTheDocument()
      expect(within(dialog).getByText(`${key.prefix}…`)).toBeInTheDocument()
      expect(revokeMcpApiKeyAction).not.toHaveBeenCalled()
    })

    it('does not revoke the key when the dialog is cancelled', () => {
      const key = keyRow()

      render(<ApiKeysSection keys={[key]} />)

      fireEvent.click(screen.getByRole('button', { name: 'list.revoke' }))
      fireEvent.click(screen.getByRole('button', { name: 'revokeDialog.cancel' }))

      expect(revokeMcpApiKeyAction).not.toHaveBeenCalled()
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'list.revoke' })).toBeInTheDocument()
    })

    it('marks a key revoked once the dialog is confirmed', async () => {
      revokeMcpApiKeyAction.mockResolvedValue('OK')
      const key = keyRow()

      render(<ApiKeysSection keys={[key]} />)

      fireEvent.click(screen.getByRole('button', { name: 'list.revoke' }))
      fireEvent.click(screen.getByRole('button', { name: 'revokeDialog.confirm' }))

      await waitFor(() => expect(revokeMcpApiKeyAction).toHaveBeenCalledWith(key.id))
      await waitFor(() => expect(screen.getByText('list.revoked')).toBeInTheDocument())
      expect(screen.queryByRole('button', { name: 'list.revoke' })).not.toBeInTheDocument()
      expect(toastSuccess).toHaveBeenCalledWith('revoked')
    })

    it('leaves the key listed as active when the confirmed action refuses', async () => {
      revokeMcpApiKeyAction.mockResolvedValue('notFound')
      const key = keyRow()

      render(<ApiKeysSection keys={[key]} />)

      fireEvent.click(screen.getByRole('button', { name: 'list.revoke' }))
      fireEvent.click(screen.getByRole('button', { name: 'revokeDialog.confirm' }))

      await waitFor(() => expect(revokeMcpApiKeyAction).toHaveBeenCalledWith(key.id))
      await waitFor(() => expect(toastError).toHaveBeenCalledWith('error'))
      expect(screen.getByRole('button', { name: 'list.revoke' })).toBeInTheDocument()
      expect(screen.queryByText('list.revoked')).not.toBeInTheDocument()
    })
  })

  describe('creation error matching', () => {
    const createWithName = () => {
      render(<ApiKeysSection keys={[]} />)
      fireEvent.change(screen.getByLabelText('nameLabel'), {
        target: { value: 'Poste admin' },
      })
      fireEvent.click(screen.getByRole('button', { name: 'create' }))
    }

    it('shows the mapped message for a known refusal', async () => {
      createMcpApiKeyAction.mockResolvedValue('tooManyKeys')

      createWithName()

      await waitFor(() => expect(toastError).toHaveBeenCalledWith('errors.tooManyKeys'))
    })

    it('falls back to the generic message for an unmapped refusal', async () => {
      createMcpApiKeyAction.mockResolvedValue('somethingNew')

      createWithName()

      await waitFor(() => expect(toastError).toHaveBeenCalledWith('error'))
    })
  })
})
