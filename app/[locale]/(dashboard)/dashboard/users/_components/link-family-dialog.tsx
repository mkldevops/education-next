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
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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
  /** Appelé après un rattachement réussi, pour que le tiroir recharge son détail. */
  onLinked?: () => void
}

export function LinkFamilyDialog({ userId, families, onLinked }: Props) {
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
        <LinkFamilyForm userId={userId} families={families} onLinked={onLinked} />
      </DialogContent>
    </Dialog>
  )
}

function LinkFamilyForm({ userId, families, onLinked }: Props) {
  const t = useTranslations('dashboard.pages.users')
  const router = useRouter()
  const { isPending, close, onSubmit } = useDialogForm(t)
  const [familyId, setFamilyId] = useState(families[0]?.id ?? '')
  const familyItems = families.map((family) => ({ value: family.id, label: family.name }))

  const handleSubmit = onSubmit(() => linkUserFamilyAction({ id: userId, familyId }), {
    successKey: 'familyLinked',
    onSuccess: () => {
      router.refresh()
      onLinked?.()
    },
  })

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody>
        <div className="space-y-2">
          <Label htmlFor="link-family">{t('family')}</Label>
          <Select
            items={familyItems}
            value={familyId}
            onValueChange={(value) => setFamilyId(value ?? '')}
            disabled={isPending}
          >
            <SelectTrigger id="link-family">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {familyItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </DialogBody>
      <DialogFormActions t={t} isPending={isPending} onCancel={close} submitKey="confirm" />
    </form>
  )
}
