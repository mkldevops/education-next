'use client'

import { Button, Card, Input, Label, Select } from '@peaklab/ui'
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
import { mcpSite } from '../_lib/mcp-client-setup'
import { Field, McpClientGuides } from './mcp-client-guides'
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
  const [created, setCreated] = useState<{ id: string; key: string } | null>(null)
  const createdKey = created?.key ?? null
  const [rows, setRows] = useState(keys)

  const liveCount = rows.filter(isLive).length
  const atCapacity = liveCount >= MCP_KEY_MAX_PER_USER

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

      setCreated({ id: result.record.id, key: result.key })
      setRows((current) => [result.record, ...current])
      setName('')
    })
  }

  const onRevoke = (id: string) => {
    startTransition(async () => {
      const result = await revokeMcpApiKeyAction(id)
      if (result !== 'OK') {
        toast.error(t.has(`errors.${result}`) ? t(`errors.${result}`) : t('error'))
        return
      }

      const revokedAt = new Date().toISOString()
      setRows((current) => current.map((row) => (row.id === id ? { ...row, revokedAt } : row)))
      // Une clé révoquée ne doit plus rester affichée ni copiable.
      setCreated((current) => (current?.id === id ? null : current))
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
            <McpClientGuides
              site={mcpSite(window.location.origin)}
              apiKey={createdKey}
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
