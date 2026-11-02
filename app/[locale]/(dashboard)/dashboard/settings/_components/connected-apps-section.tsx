'use client'

import {
  Button,
  Card,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  useDialog,
} from '@peaklab/ui'
import { Unplug } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { formatDate, formatDateTime } from '@/lib/date'
import { toast } from '@/lib/toast'
import { mcpSite } from '../_lib/mcp-client-setup'
import { revokeMcpOAuthGrantAction } from '../_lib/mcp-oauth-grant-actions'
import type { McpOAuthGrantView } from '../_lib/mcp-oauth-grant-view'
import { ClaudeConnectionGuide } from './claude-connection-guide'
import { Field } from './mcp-client-guides'

type Props = {
  connections: McpOAuthGrantView[]
}

const SETUP_STEPS = ['step1', 'step2', 'step3', 'step4'] as const

/**
 * Connexions OAuth de l'administrateur sur l'école active — ChatGPT, ou tout client qui
 * s'est enregistré puis a reçu un consentement. Il n'y a rien à créer ici : une
 * connexion naît dans le client, sur l'écran de consentement. Seule la révocation est
 * offerte, et le parcours ChatGPT n'exige aucune clé — d'où sa place hors des clés.
 */
export function ConnectedAppsSection({ connections }: Props) {
  const t = useTranslations('settings.apiKeys.connections')
  const locale = useLocale()
  const [pending, startTransition] = useTransition()
  const [rows, setRows] = useState(connections)
  const site = mcpSite(window.location.origin)

  const copy = (value: string) => {
    navigator.clipboard.writeText(value).then(
      () => toast.success(t('copied')),
      () => toast.error(t('copyFailed'))
    )
  }

  const onRevoke = (id: string) => {
    startTransition(async () => {
      const result = await revokeMcpOAuthGrantAction(id)
      if (result !== 'OK') {
        toast.error(t.has(`errors.${result}`) ? t(`errors.${result}`) : t('error'))
        return
      }

      const revokedAt = new Date().toISOString()
      setRows((current) => current.map((row) => (row.id === id ? { ...row, revokedAt } : row)))
      toast.success(t('revoked'))
    })
  }

  return (
    <Card className="rounded border border-alabaster-700 p-6">
      <h3 className="text-base font-semibold text-graphite">{t('title')}</h3>
      <p className="mt-1 text-sm text-graphite-600">{t('description')}</p>

      <ClaudeConnectionGuide site={site} onCopy={copy} />

      <details className="mt-4 rounded border border-alabaster-700 px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium text-graphite">
          {t('setup.title')}
        </summary>
        <div className="mt-3 space-y-3">
          <ol className="list-decimal space-y-1 pl-5 text-sm text-graphite">
            {SETUP_STEPS.map((step) => (
              <li key={step}>{t(`setup.${step}`, { name: site.serverName })}</li>
            ))}
          </ol>
          <Field
            label={t('setup.urlLabel')}
            value={site.url}
            copyLabel={t('setup.copyUrl')}
            onCopy={copy}
          />
        </div>
      </details>

      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-graphite-600">{t('empty')}</p>
      ) : (
        <ul className="mt-4 divide-y divide-alabaster-700">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-graphite">{row.clientName}</p>
                <p className="mt-0.5 text-xs text-graphite-600">
                  {t('created', { date: formatDate(row.createdAt, locale) })} ·{' '}
                  {row.lastUsedAt
                    ? t('lastUsed', { date: formatDateTime(row.lastUsedAt, locale) })
                    : t('neverUsed')}
                </p>
              </div>
              {row.revokedAt !== null ? (
                <span className="shrink-0 text-xs text-graphite-600">{t('revokedLabel')}</span>
              ) : (
                <RevokeConnectionDialog
                  connection={row}
                  pending={pending}
                  onConfirm={() => onRevoke(row.id)}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

type DialogProps = {
  connection: McpOAuthGrantView
  pending: boolean
  onConfirm: () => void
}

function RevokeConnectionDialog({ connection, pending, onConfirm }: DialogProps) {
  const t = useTranslations('settings.apiKeys.connections')

  return (
    <Dialog>
      <DialogTrigger>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          aria-label={t('revoke', { name: connection.clientName })}
        >
          <Unplug className="h-4 w-4" aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('revokeDialog.title', { name: connection.clientName })}</DialogTitle>
        </DialogHeader>
        <RevokeConnectionForm connection={connection} pending={pending} onConfirm={onConfirm} />
      </DialogContent>
    </Dialog>
  )
}

function RevokeConnectionForm({ connection, pending, onConfirm }: DialogProps) {
  const t = useTranslations('settings.apiKeys.connections')
  const { setOpen } = useDialog()

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault()
    setOpen(false)
    onConfirm()
  }

  return (
    <form onSubmit={handleConfirm}>
      <DialogBody>
        <p className="text-sm text-graphite-600">{t('revokeDialog.warning')}</p>
        <div className="mt-3 rounded border border-alabaster-700 bg-alabaster-900 px-3 py-2">
          <p className="text-sm font-medium text-graphite">{connection.clientName}</p>
        </div>
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
          {t('revokeDialog.cancel')}
        </Button>
        <Button type="submit" variant="destructive" disabled={pending}>
          {t('revokeDialog.confirm')}
        </Button>
      </DialogFooter>
    </form>
  )
}
