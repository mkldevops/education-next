'use client'

import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Label,
  Select,
} from '@peaklab/ui'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { DialogFormActions, useDialogForm } from '@/features/forms'
import { useRouter } from '@/i18n/routing'
import { linkUserFamilyAction } from '../../../_lib/user-actions'
import type { FamilyOption } from './users-table'

interface Props {
  userId: string
  families: FamilyOption[]
}

export function LinkFamilyDialog({ userId, families }: Props) {
  const t = useTranslations('dashboard.pages.users')

  if (families.length === 0) return null

  return (
    <Dialog>
      <DialogTrigger>
        <Button variant="outline" size="sm">
          {t('linkFamily')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('linkFamily')}</DialogTitle>
        </DialogHeader>
        <LinkFamilyForm userId={userId} families={families} />
      </DialogContent>
    </Dialog>
  )
}

function LinkFamilyForm({ userId, families }: Props) {
  const t = useTranslations('dashboard.pages.users')
  const router = useRouter()
  const { isPending, close, onSubmit } = useDialogForm(t)
  const [familyId, setFamilyId] = useState(families[0]?.id ?? '')

  const handleSubmit = onSubmit(() => linkUserFamilyAction({ id: userId, familyId }), {
    successKey: 'familyLinked',
    onSuccess: () => router.refresh(),
  })

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody>
        <div className="space-y-2">
          <Label htmlFor="link-family">{t('family')}</Label>
          <Select
            id="link-family"
            value={familyId}
            onChange={(e) => setFamilyId(e.target.value)}
            disabled={isPending}
          >
            {families.map((family) => (
              <option key={family.id} value={family.id}>
                {family.name}
              </option>
            ))}
          </Select>
        </div>
      </DialogBody>
      <DialogFormActions t={t} isPending={isPending} onCancel={close} submitKey="confirm" />
    </form>
  )
}
