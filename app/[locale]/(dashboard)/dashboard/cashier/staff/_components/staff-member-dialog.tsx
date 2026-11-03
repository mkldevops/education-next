'use client'

import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
} from '@peaklab/ui'
import { Pencil, Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { DialogFormActions, useDialogForm } from '@/features/forms'
import { createStaffMemberAction, updateStaffMemberAction } from '../../../../_lib/staff-actions'

type Member = {
  id: string
  name: string
  note: string | null
  mealExempt: boolean
  isActive: boolean
}

type Props = { member?: Member }

/** Ajoute un membre du personnel, ou le modifie quand `member` est fourni. */
export function StaffMemberDialog({ member }: Props) {
  const t = useTranslations('dashboard.pages.cashier.staff.dialog')

  return (
    <Dialog>
      <DialogTrigger>
        <Button variant="outline" size="sm">
          {member ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {member ? t('editTitle') : t('addTitle')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{member ? t('editTitle') : t('addTitle')}</DialogTitle>
        </DialogHeader>
        <StaffMemberForm member={member} />
      </DialogContent>
    </Dialog>
  )
}

function StaffMemberForm({ member }: Props) {
  const t = useTranslations('dashboard.pages.cashier.staff.dialog')
  const { isPending, close, onSubmit } = useDialogForm(t)
  const prefix = member ? `staff-${member.id}` : 'staff-new'

  const handleSubmit = onSubmit((formData) => {
    const data = {
      name: String(formData.get('name') ?? ''),
      note: String(formData.get('note') ?? ''),
      mealExempt: formData.get('mealExempt') === 'on',
    }
    return member
      ? updateStaffMemberAction({
          ...data,
          id: member.id,
          isActive: formData.get('isActive') === 'on',
        })
      : createStaffMemberAction(data)
  })

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`${prefix}-name`}>{t('name')}</Label>
            <Input
              id={`${prefix}-name`}
              name="name"
              defaultValue={member?.name}
              maxLength={250}
              required
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${prefix}-note`}>{t('note')}</Label>
            <Input
              id={`${prefix}-note`}
              name="note"
              defaultValue={member?.note ?? ''}
              maxLength={250}
              placeholder={t('notePlaceholder')}
              disabled={isPending}
            />
          </div>
          <label className="flex items-start gap-2 text-sm text-graphite">
            <input
              type="checkbox"
              name="mealExempt"
              defaultChecked={member?.mealExempt}
              className="mt-0.5 rounded"
              disabled={isPending}
            />
            <span>
              {t('mealExempt')}
              <span className="block text-xs text-graphite-600">{t('mealExemptHint')}</span>
            </span>
          </label>
          {member && (
            <label className="flex items-center gap-2 text-sm text-graphite">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked={member.isActive}
                className="rounded"
                disabled={isPending}
              />
              {t('isActive')}
            </label>
          )}
        </div>
      </DialogBody>
      <DialogFormActions t={t} isPending={isPending} onCancel={close} />
    </form>
  )
}
