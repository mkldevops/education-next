'use client'

import { Button, ConfirmDialog, Input, Label } from '@peaklab/ui'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useId, useState, useTransition } from 'react'
import { ABSENCE_REASON_LABEL_MAX } from '@/domain/absence-reason'
import { useRouter } from '@/i18n/routing'
import { toast, toastActionError } from '@/lib/toast'
import {
  archiveAbsenceReasonAction,
  createAbsenceReasonAction,
  reorderAbsenceReasonsAction,
  updateAbsenceReasonAction,
} from '../../../_lib/absence-reason-actions'
import { OptionRow } from './option-row'

export type AbsenceReasonSetting = { id: string; label: string; justified: boolean }

/**
 * Option « Motifs d'absence » du module Appel : les premiers motifs en aperçu, et la liste
 * dépliée sur place par « Gérer » pour ne pas empiler un second dialogue sur celui du module.
 */
export function AbsenceReasonsOption({ reasons }: { reasons: AbsenceReasonSetting[] }) {
  const t = useTranslations('dashboard.pages.config.absenceReasons')
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const preview = reasons.slice(0, 3).map((reason) => reason.label)

  return (
    <div>
      <OptionRow
        label={t('title')}
        description={
          preview.length === 0
            ? t('empty')
            : `${preview.join(', ')}${reasons.length > preview.length ? '…' : ''}`
        }
      >
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? t('hide') : t('manage', { count: reasons.length })}
        </Button>
      </OptionRow>
      {open && (
        <div id={panelId} className="divide-y divide-alabaster-700 bg-alabaster-900">
          <AbsenceReasonsEditor reasons={reasons} />
        </div>
      )}
    </div>
  )
}

/**
 * Motifs proposés sur une absence pendant l'appel. Archiver retire un motif de la saisie sans
 * toucher aux appels passés, qui gardent le libellé enregistré.
 */
function AbsenceReasonsEditor({ reasons }: { reasons: AbsenceReasonSetting[] }) {
  const t = useTranslations('dashboard.pages.config.absenceReasons')
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [label, setLabel] = useState('')
  const [justified, setJustified] = useState(true)
  const inputId = useId()

  const run = (action: () => Promise<unknown>, onDone?: () => void) =>
    startTransition(async () => {
      try {
        const result = await action()
        if (typeof result === 'string' && result !== 'OK') {
          toastActionError(t, result)
          return
        }
        onDone?.()
        router.refresh()
      } catch {
        toast.error(t('error'))
      }
    })

  const add = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!label.trim()) return
    run(
      () => createAbsenceReasonAction({ label, justified }),
      () => {
        setLabel('')
        toast.success(t('added'))
      }
    )
  }

  const move = (index: number, offset: -1 | 1) => {
    const ids = reasons.map((reason) => reason.id)
    const target = index + offset
    if (target < 0 || target >= ids.length) return
    ;[ids[index], ids[target]] = [ids[target] as string, ids[index] as string]
    run(() => reorderAbsenceReasonsAction({ ids }))
  }

  return (
    <>
      {reasons.length === 0 ? (
        <p className="px-6 py-5 text-sm text-graphite-600">{t('empty')}</p>
      ) : (
        <ul className="divide-y divide-alabaster-700">
          {reasons.map((reason, index) => (
            <li
              key={`${reason.id}:${reason.label}`}
              className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center"
            >
              <Input
                aria-label={t('label')}
                defaultValue={reason.label}
                maxLength={ABSENCE_REASON_LABEL_MAX}
                disabled={pending}
                className="sm:flex-1"
                onBlur={(event) => {
                  const next = event.currentTarget.value
                  if (next.trim() && next.trim() !== reason.label) {
                    run(() => updateAbsenceReasonAction({ id: reason.id, label: next }))
                  }
                }}
              />
              <div className="flex items-center gap-2">
                <label className="flex min-h-11 items-center gap-2 text-sm text-graphite">
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={reason.justified}
                    disabled={pending}
                    onChange={(event) =>
                      run(() =>
                        updateAbsenceReasonAction({
                          id: reason.id,
                          justified: event.currentTarget.checked,
                        })
                      )
                    }
                  />
                  {t('justified')}
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={t('moveUp', { label: reason.label })}
                  disabled={pending || index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUp aria-hidden="true" className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={t('moveDown', { label: reason.label })}
                  disabled={pending || index === reasons.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDown aria-hidden="true" className="size-4" />
                </Button>
                <ConfirmDialog
                  trigger={
                    <Button type="button" variant="outline" size="sm" disabled={pending}>
                      {t('archive')}
                    </Button>
                  }
                  title={t('confirmArchive.title', { label: reason.label })}
                  description={t('confirmArchive.description')}
                  confirmLabel={t('confirmArchive.confirm')}
                  cancelLabel={t('confirmArchive.cancel')}
                  onConfirm={() => run(() => archiveAbsenceReasonAction({ id: reason.id }))}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={add} className="flex flex-col gap-3 px-6 py-5 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-2">
          <Label htmlFor={inputId}>{t('newLabel')}</Label>
          <Input
            id={inputId}
            value={label}
            maxLength={ABSENCE_REASON_LABEL_MAX}
            placeholder={t('placeholder')}
            disabled={pending}
            onChange={(event) => setLabel(event.target.value)}
          />
        </div>
        <label className="flex min-h-11 items-center gap-2 text-sm text-graphite">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={justified}
            disabled={pending}
            onChange={(event) => setJustified(event.currentTarget.checked)}
          />
          {t('justified')}
        </label>
        <Button type="submit" disabled={pending || !label.trim()}>
          {t('add')}
        </Button>
      </form>
    </>
  )
}
