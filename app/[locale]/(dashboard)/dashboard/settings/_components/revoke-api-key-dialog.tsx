'use client'

import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  useDialog,
} from '@peaklab/ui'
import { Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { McpApiKeyView } from '../_lib/mcp-api-key-view'

interface Props {
  apiKey: McpApiKeyView
  pending: boolean
  onConfirm: () => void
}

/**
 * La révocation ne réécrit jamais `revokedAt` en arrière : ce dialogue est la seule
 * occasion de nommer la clé (nom + préfixe) avant un geste sans retour possible.
 */
export function RevokeApiKeyDialog({ apiKey, pending, onConfirm }: Props) {
  const t = useTranslations('settings.apiKeys')

  return (
    <Dialog>
      <DialogTrigger>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          aria-label={t('list.revoke', { name: apiKey.name })}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('revokeDialog.title', { name: apiKey.name })}</DialogTitle>
        </DialogHeader>
        <RevokeApiKeyForm apiKey={apiKey} pending={pending} onConfirm={onConfirm} />
      </DialogContent>
    </Dialog>
  )
}

function RevokeApiKeyForm({ apiKey, pending, onConfirm }: Props) {
  const t = useTranslations('settings.apiKeys')
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
          <p className="text-sm font-medium text-graphite">{apiKey.name}</p>
          <p className="mt-0.5 font-mono text-xs text-graphite-600">{apiKey.prefix}…</p>
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
