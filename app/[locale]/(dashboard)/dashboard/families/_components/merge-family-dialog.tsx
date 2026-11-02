'use client'

import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRouteOpener,
  DialogTitle,
  Input,
  Label,
} from '@peaklab/ui'
import { useTranslations } from 'next-intl'
import { useId, useState } from 'react'
import { useDialogForm } from '@/features/forms'
import { useRouter } from '@/i18n/routing'
import { mergeFamiliesAction } from '../../../_lib/family-actions'

type Props = {
  familyId: string
  familyName: string
  families: Array<{ id: string; name: string }>
  cleanUrl: string
  defaultOpen?: boolean
}

export function MergeFamilyDialog(props: Props) {
  const t = useTranslations('dashboard.pages.families.merge')
  return (
    <Dialog initialOpen={props.defaultOpen}>
      <DialogRouteOpener open={props.defaultOpen ?? false} cleanUrl={props.cleanUrl} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>
        <MergeFamilyForm {...props} />
      </DialogContent>
    </Dialog>
  )
}

function MergeFamilyForm({ familyId, familyName, families }: Props) {
  const t = useTranslations('dashboard.pages.families.merge')
  const { isPending, close, run } = useDialogForm(t)
  const router = useRouter()
  const selectId = useId()
  const confirmationId = useId()
  const [targetId, setTargetId] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [query, setQuery] = useState('')
  const target = families.find((family) => family.id === targetId)
  const matches = families.filter((family) =>
    family.name.toLocaleLowerCase().includes(query.toLocaleLowerCase())
  )

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        if (!target || !confirmed) return
        run(() => mergeFamiliesAction(familyId, target.id), {
          onSuccess: () => router.push(`/dashboard/families/${target.id}`),
        })
      }}
    >
      <DialogBody>
        <p className="text-sm text-graphite-600">{t('description', { name: familyName })}</p>
        <div className="space-y-2">
          <Label htmlFor={`${selectId}-search`}>{t('search')}</Label>
          <Input
            id={`${selectId}-search`}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <Label htmlFor={selectId}>{t('target')}</Label>
          <select
            id={selectId}
            value={targetId}
            required
            disabled={isPending}
            className="w-full rounded border border-alabaster-700 bg-white p-2 text-sm"
            onChange={(event) => {
              setTargetId(event.target.value)
              setConfirmed(false)
            }}
          >
            <option value="">{t('choose')}</option>
            {families
              .filter((family) => family.id === targetId || matches.includes(family))
              .map((family) => (
                <option key={family.id} value={family.id}>
                  {family.name} · {family.id.slice(0, 8)}
                </option>
              ))}
          </select>
        </div>
        {target && (
          <p className="text-sm font-medium">
            {t('preview', { source: familyName, target: target.name })}
          </p>
        )}
        <p className="text-sm text-graphite-600">{t('accessWarning')}</p>
        <div className="flex items-start gap-2">
          <input
            id={confirmationId}
            type="checkbox"
            checked={confirmed}
            disabled={isPending || !target}
            onChange={(event) => setConfirmed(event.target.checked)}
          />
          <Label htmlFor={confirmationId}>{t('confirmation')}</Label>
        </div>
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={close} disabled={isPending}>
          {t('cancel')}
        </Button>
        <Button type="submit" disabled={isPending || !target || !confirmed}>
          {t('confirm')}
        </Button>
      </DialogFooter>
    </form>
  )
}
