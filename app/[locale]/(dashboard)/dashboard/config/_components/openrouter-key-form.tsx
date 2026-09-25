'use client'

import { Button, ConfirmDialog, Input, Label } from '@peaklab/ui'
import { useTranslations } from 'next-intl'
import { useId, useState, useTransition } from 'react'
import { useRouter } from '@/i18n/routing'
import { toast } from '@/lib/toast'
import {
  deleteOpenRouterApiKeyAction,
  setOpenRouterApiKeyAction,
} from '../../../_lib/platform-settings-actions'

export type OpenRouterKeyStatus = 'configured' | 'notConfigured' | 'unreadable'

type Props = {
  status: OpenRouterKeyStatus
  secretStorageConfigured: boolean
}

/**
 * La clé ne fait que descendre : le champ est vidé après enregistrement et la page ne
 * remonte qu'un état. Un super-admin qui a perdu la clé la remplace, il ne la relit pas.
 */
export function OpenRouterKeyForm({ status, secretStorageConfigured }: Props) {
  const t = useTranslations('dashboard.pages.integrations.openRouter')
  const router = useRouter()
  const inputId = useId()
  const [value, setValue] = useState('')
  const [pending, startTransition] = useTransition()

  const save = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    startTransition(async () => {
      try {
        const result = await setOpenRouterApiKeyAction(value)
        if (result !== 'OK') {
          toast.error(t(`errors.${result}`))
          return
        }
        setValue('')
        toast.success(t('saved'))
        router.refresh()
      } catch {
        toast.error(t('errors.error'))
      }
    })
  }

  const remove = async () => {
    try {
      await deleteOpenRouterApiKeyAction()
      toast.success(t('deleted'))
      router.refresh()
    } catch {
      toast.error(t('errors.error'))
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
        <span className={badge}>{t(`status.${status}`)}</span>
      </div>
      <p className="mt-1 text-sm text-graphite-600">{t('description')}</p>
      {status === 'unreadable' && (
        <p className="mt-2 text-xs text-orange-600">{t('unreadableHint')}</p>
      )}
      {!secretStorageConfigured && (
        <p className="mt-2 text-xs text-orange-600">{t('secretStorageHint')}</p>
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
          {status === 'notConfigured' ? t('save') : t('replace')}
        </Button>
        {status !== 'notConfigured' && (
          <ConfirmDialog
            trigger={
              <Button type="button" variant="outline" disabled={pending}>
                {t('delete')}
              </Button>
            }
            title={t('confirmDelete.title')}
            description={t('confirmDelete.description')}
            confirmLabel={t('confirmDelete.confirm')}
            cancelLabel={t('confirmDelete.cancel')}
            onConfirm={remove}
          />
        )}
      </form>
    </div>
  )
}
