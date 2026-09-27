'use client'

import { Button, ConfirmDialog, Input, Label } from '@peaklab/ui'
import { useTranslations } from 'next-intl'
import { useId, useState, useTransition } from 'react'
import { useRouter } from '@/i18n/routing'
import type { StripeSecretKind } from '@/lib/stripe-config'
import { toast } from '@/lib/toast'
import type { StripeSecretStatus } from '@/use-cases/payments/stripe-settings'
import {
  deleteStripeSecretAction,
  setStripeSecretAction,
} from '../../../_lib/stripe-settings-actions'

type Props = {
  kind: StripeSecretKind
  status: StripeSecretStatus
  secretStorageConfigured: boolean
}

/**
 * Le secret ne fait que descendre : le champ est vidé après enregistrement et la page ne
 * remonte qu'un état. Un secret perdu se remplace, il ne se relit pas.
 */
export function StripeSecretForm({ kind, status, secretStorageConfigured }: Props) {
  const t = useTranslations(`dashboard.pages.config.stripe.${kind}`)
  const tShared = useTranslations('dashboard.pages.config.stripe')
  const router = useRouter()
  const inputId = useId()
  const [value, setValue] = useState('')
  const [pending, startTransition] = useTransition()

  const save = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    startTransition(async () => {
      try {
        const result = await setStripeSecretAction(kind, value)
        if (result !== 'OK') {
          toast.error(t(`errors.${result}`))
          return
        }
        setValue('')
        toast.success(t('saved'))
        router.refresh()
      } catch {
        toast.error(tShared('errors.error'))
      }
    })
  }

  const remove = async () => {
    try {
      const result = await deleteStripeSecretAction(kind)
      if (result !== 'OK') {
        toast.error(tShared('errors.error'))
        return
      }
      toast.success(t('deleted'))
      router.refresh()
    } catch {
      toast.error(tShared('errors.error'))
    }
  }

  const badge =
    status === 'configured'
      ? 'rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700'
      : status === 'unreadable'
        ? 'rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700'
        : 'rounded-full bg-alabaster-800 px-2 py-0.5 text-xs font-medium text-graphite-600'

  return (
    <div className="px-6 py-5">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold text-graphite">{t('title')}</h3>
        <span className={badge}>{tShared(`status.${status}`)}</span>
      </div>
      <p className="mt-1 text-sm text-graphite-600">{t('description')}</p>
      {status === 'configured' && (
        <p className="mt-2 font-mono text-xs text-graphite-600">{t('masked')}</p>
      )}
      {status === 'unreadable' && (
        <p className="mt-2 text-xs text-orange-600">{tShared('unreadableHint')}</p>
      )}

      <form onSubmit={save} className="mt-4 flex max-w-xl flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Label htmlFor={inputId}>
            {status === 'notConfigured' ? t('label') : t('replaceLabel')}
          </Label>
          <Input
            id={inputId}
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={t('placeholder')}
            disabled={pending || !secretStorageConfigured}
          />
        </div>
        <Button type="submit" disabled={pending || !secretStorageConfigured || value.trim() === ''}>
          {status === 'notConfigured' ? tShared('save') : tShared('replace')}
        </Button>
        {status !== 'notConfigured' && (
          <ConfirmDialog
            trigger={
              <Button type="button" variant="outline" disabled={pending}>
                {tShared('delete')}
              </Button>
            }
            title={t('confirmDelete.title')}
            description={t('confirmDelete.description')}
            confirmLabel={tShared('delete')}
            cancelLabel={tShared('cancel')}
            onConfirm={remove}
          />
        )}
      </form>
    </div>
  )
}
