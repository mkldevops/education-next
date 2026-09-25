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

    it('hides the new-key panel once the key it shows is revoked', async () => {
      const record = keyRow({ name: 'Poste admin' })
      createMcpApiKeyAction.mockResolvedValue({ key: 'edu_mcp_secret', record })
      revokeMcpApiKeyAction.mockResolvedValue('OK')

      render(<ApiKeysSection keys={[]} />)
      fireEvent.change(screen.getByLabelText('nameLabel'), { target: { value: 'Poste admin' } })
      fireEvent.click(screen.getByRole('button', { name: 'create' }))

      await waitFor(() => expect(screen.getByText('created.title')).toBeInTheDocument())

      // La transition de création doit être terminée avant d'ouvrir la confirmation.
      await waitFor(() => expect(screen.getByRole('button', { name: 'list.revoke' })).toBeEnabled())
      fireEvent.click(screen.getByRole('button', { name: 'list.revoke' }))
      fireEvent.click(await screen.findByRole('button', { name: 'revokeDialog.confirm' }))

      await waitFor(() => expect(revokeMcpApiKeyAction).toHaveBeenCalledWith(record.id))
      await waitFor(() => expect(screen.queryByText('created.title')).not.toBeInTheDocument())
      expect(screen.queryByDisplayValue('edu_mcp_secret')).not.toBeInTheDocument()
    })

    it('keeps the new-key panel when another key is revoked', async () => {
      const other = keyRow({ name: 'Ancien poste' })
      const record = keyRow({ name: 'Poste admin' })
      createMcpApiKeyAction.mockResolvedValue({ key: 'edu_mcp_secret', record })
      revokeMcpApiKeyAction.mockResolvedValue('OK')

      render(<ApiKeysSection keys={[other]} />)
      fireEvent.change(screen.getByLabelText('nameLabel'), { target: { value: 'Poste admin' } })
      fireEvent.click(screen.getByRole('button', { name: 'create' }))

      await waitFor(() => expect(screen.getByText('created.title')).toBeInTheDocument())

      // Les lignes sont triées la plus récente d'abord : la seconde est l'ancienne clé.
      await waitFor(() =>
        expect(screen.getAllByRole('button', { name: 'list.revoke' })[1]).toBeEnabled()
      )
      fireEvent.click(screen.getAllByRole('button', { name: 'list.revoke' })[1])
      fireEvent.click(await screen.findByRole('button', { name: 'revokeDialog.confirm' }))

      await waitFor(() => expect(revokeMcpApiKeyAction).toHaveBeenCalledWith(other.id))
      await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('revoked'))
      expect(screen.getByText('created.title')).toBeInTheDocument()
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

  describe('client guides', () => {
    const writeText = vi.fn()
    const secret = 'edu_mcp_secret'
    const site = () => window.location.origin
    const host = () => window.location.host.replace(/[^a-z0-9]+/g, '-')

    const createKey = async () => {
      createMcpApiKeyAction.mockResolvedValue({ key: secret, record: keyRow() })
      render(<ApiKeysSection keys={[]} />)
      fireEvent.change(screen.getByLabelText('nameLabel'), { target: { value: 'Poste admin' } })
      fireEvent.click(screen.getByRole('button', { name: 'create' }))
      await waitFor(() => expect(screen.getByText('created.title')).toBeInTheDocument())
    }

    beforeEach(() => {
      writeText.mockResolvedValue(undefined)
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    })

    it('offers the four clients as keyboard-reachable tabs', async () => {
      await createKey()

      const names = ['claudeCode', 'codex', 'claudeWeb', 'chatgpt'].map(
        (client) => `clients.${client}.label`
      )
      expect(screen.getByRole('tablist', { name: 'clientsLabel' })).toBeInTheDocument()
      for (const name of names) {
        expect(screen.getByRole('tab', { name })).toBeInTheDocument()
      }

      const first = screen.getByRole('tab', { name: names[0] })
      fireEvent.keyDown(first, { key: 'ArrowRight' })
      expect(screen.getByRole('tab', { name: names[1] })).toHaveAttribute('aria-selected', 'true')
    })

    it('copies a Claude Code command aimed at the current site', async () => {
      await createKey()

      expect(screen.getByText('status.ready')).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'clients.claudeCode.copyCommand' }))

      await waitFor(() =>
        expect(writeText).toHaveBeenCalledWith(
          `claude mcp add --transport http education-${host()} ${site()}/api/mcp --header "Authorization: Bearer ${secret}"`
        )
      )
      expect(toastSuccess).toHaveBeenCalledWith('copied')
    })

    it('keeps the key out of the Codex configuration and in its own variable', async () => {
      await createKey()
      fireEvent.click(screen.getByRole('tab', { name: 'clients.codex.label' }))
      expect(screen.getByText('status.ready')).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'clients.codex.copyConfig' }))
      await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))
      const config = writeText.mock.calls[0][0] as string
      expect(config).toContain(`url = "${site()}/api/mcp"`)
      expect(config).toContain('bearer_token_env_var')
      expect(config).not.toContain(secret)

      fireEvent.click(screen.getByRole('button', { name: 'clients.codex.copyToken' }))
      await waitFor(() => expect(writeText).toHaveBeenCalledTimes(2))
      expect(writeText.mock.calls[1][0]).toContain(`="${secret}"`)
      expect(screen.getByText('clients.codex.webNote')).toBeInTheDocument()
    })

    it.each([
      ['claudeWeb', 'status.headersBeta', 4],
      ['chatgpt', 'status.oauthRequired', 3],
    ])(
      'shows %s as a web procedure with status %s, without the key or a command',
      async (client, status, steps) => {
        await createKey()
        fireEvent.click(screen.getByRole('tab', { name: `clients.${client}.label` }))

        const panel = screen.getByRole('tabpanel', { name: `clients.${client}.label` })
        expect(within(panel).getByText(status)).toBeInTheDocument()
        expect(within(panel).getByText(`clients.${client}.note`)).toBeInTheDocument()
        expect(within(panel).getAllByRole('listitem')).toHaveLength(steps)
        expect(within(panel).getByText(`${site()}/api/mcp`)).toBeInTheDocument()
        expect(within(panel).queryByText(new RegExp(secret))).not.toBeInTheDocument()
        expect(within(panel).queryByText(/claude mcp add|mcp_servers/)).not.toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'copyUrl' }))
        await waitFor(() => expect(writeText).toHaveBeenCalledWith(`${site()}/api/mcp`))
      }
    )
  })
})
