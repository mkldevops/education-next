'use client'

import { Button, Card, Input, Label, Select } from '@peaklab/ui'
import { Copy } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import {
  isKeyUsable,
  MCP_KEY_DEFAULT_LIFETIME_DAYS,
  MCP_KEY_LIFETIMES_DAYS,
  MCP_KEY_MAX_PER_USER,
} from '@/domain/mcp-key'
import { formatDate, formatDateTime } from '@/lib/date'
import { toast } from '@/lib/toast'
import { createMcpApiKeyAction, revokeMcpApiKeyAction } from '../_lib/mcp-api-key-actions'
import type { McpApiKeyView } from '../_lib/mcp-api-key-view'
import { RevokeApiKeyDialog } from './revoke-api-key-dialog'

type Props = {
  keys: McpApiKeyView[]
}

const isLive = (row: McpApiKeyView) =>
  isKeyUsable({
    revokedAt: row.revokedAt === null ? null : new Date(row.revokedAt),
    expiresAt: new Date(row.expiresAt),
  })

/**
 * L'onglet montre la clé en clair une seule fois, sans jamais la relire : la base n'en
 * garde que le hachage, et un second affichage supposerait de la conserver déchiffrable.
 */
export function ApiKeysSection({ keys }: Props) {
  const t = useTranslations('settings.apiKeys')
  const locale = useLocale()
  const [pending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [lifetimeDays, setLifetimeDays] = useState<number>(MCP_KEY_DEFAULT_LIFETIME_DAYS)
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [rows, setRows] = useState(keys)

  const liveCount = rows.filter(isLive).length
  const atCapacity = liveCount >= MCP_KEY_MAX_PER_USER

  const command = createdKey
    ? `claude mcp add --transport http education ${origin()}/api/mcp --header "Authorization: Bearer ${createdKey}"`
    : ''

  const copy = (value: string) => {
    navigator.clipboard.writeText(value).then(
      () => toast.success(t('copied')),
      () => toast.error(t('copyFailed'))
    )
  }

  const onCreate = () => {
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error(t('nameRequired'))
      return
    }

    startTransition(async () => {
      const result = await createMcpApiKeyAction({ name: trimmed, lifetimeDays })
      if (typeof result === 'string') {
        toast.error(t.has(`errors.${result}`) ? t(`errors.${result}`) : t('error'))
        return
      }

      setCreatedKey(result.key)
      setRows((current) => [result.record, ...current])
      setName('')
    })
  }

  const onRevoke = (id: string) => {
    startTransition(async () => {
      const result = await revokeMcpApiKeyAction(id)
      if (result !== 'OK') {
        toast.error(t('error'))
        return
      }

      const revokedAt = new Date().toISOString()
      setRows((current) => current.map((row) => (row.id === id ? { ...row, revokedAt } : row)))
      toast.success(t('revoked'))
    })
  }

  return (
    <div className="space-y-6">
      <Card className="rounded border border-alabaster-700 p-6">
        <h2 className="text-lg font-semibold text-graphite">{t('title')}</h2>
        <p className="mt-1 text-sm text-graphite-600">{t('description')}</p>

        <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <div className="space-y-1">
            <Label htmlFor="mcp-key-name">{t('nameLabel')}</Label>
            <Input
              id="mcp-key-name"
              value={name}
              maxLength={80}
              disabled={pending || atCapacity}
              placeholder={t('namePlaceholder')}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="mcp-key-lifetime">{t('lifetimeLabel')}</Label>
            <Select
              id="mcp-key-lifetime"
              value={lifetimeDays}
              disabled={pending || atCapacity}
              onChange={(event) => setLifetimeDays(Number(event.target.value))}
            >
              {MCP_KEY_LIFETIMES_DAYS.map((days) => (
                <option key={days} value={days}>
                  {t('lifetimeDays', { days })}
                </option>
              ))}
            </Select>
          </div>
          <Button type="button" disabled={pending || atCapacity} onClick={onCreate}>
            {t('create')}
          </Button>
        </div>
        {atCapacity && (
          <p className="mt-2 text-sm text-orange-600">
            {t('atCapacity', { max: MCP_KEY_MAX_PER_USER })}
          </p>
        )}
      </Card>

      {createdKey && (
        <Card className="rounded border border-primary p-6">
          <h3 className="text-base font-semibold text-graphite">{t('created.title')}</h3>
          <p className="mt-1 text-sm text-orange-600">{t('created.warning')}</p>

          <div className="mt-4 space-y-3">
            <Field
              label={t('created.keyLabel')}
              value={createdKey}
              copyLabel={t('created.copyKey')}
              onCopy={copy}
            />
            <Field
              label={t('created.commandLabel')}
              value={command}
              copyLabel={t('created.copyCommand')}
              onCopy={copy}
            />
          </div>
        </Card>
      )}

      <Card className="rounded border border-alabaster-700 p-6">
        <h3 className="text-base font-semibold text-graphite">{t('list.title')}</h3>
        {rows.length === 0 ? (
          <p className="mt-2 text-sm text-graphite-600">{t('list.empty')}</p>
        ) : (
          <ul className="mt-4 divide-y divide-alabaster-700">
            {rows.map((row) => {
              const revoked = row.revokedAt !== null

              return (
                <li key={row.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-graphite">{row.name}</p>
                    <p className="mt-0.5 font-mono text-xs text-graphite-600">{row.prefix}…</p>
                    <p className="mt-0.5 text-xs text-graphite-600">
                      {t('list.created', { date: formatDate(row.createdAt, locale) })} ·{' '}
                      {t('list.expires', { date: formatDate(row.expiresAt, locale) })} ·{' '}
                      {row.lastUsedAt
                        ? t('list.lastUsed', { date: formatDateTime(row.lastUsedAt, locale) })
                        : t('list.neverUsed')}
                    </p>
                  </div>
                  {!isLive(row) ? (
                    <span className="shrink-0 text-xs text-graphite-600">
                      {revoked ? t('list.revoked') : t('list.expired')}
                    </span>
                  ) : (
                    <RevokeApiKeyDialog
                      apiKey={row}
                      pending={pending}
                      onConfirm={() => onRevoke(row.id)}
                    />
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </div>
  )
}

function origin() {
  return typeof window === 'undefined' ? '' : window.location.origin
}

type FieldProps = {
  label: string
  value: string
  copyLabel: string
  onCopy: (value: string) => void
}

function Field({ label, value, copyLabel, onCopy }: FieldProps) {
  return (
    <div>
      <p className="text-xs font-medium text-graphite-600">{label}</p>
      <div className="mt-1 flex items-start gap-2">
        <code className="min-w-0 flex-1 break-all rounded bg-alabaster-900 px-3 py-2 font-mono text-xs text-graphite">
          {value}
        </code>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={copyLabel}
          onClick={() => onCopy(value)}
        >
          <Copy className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  )
}
