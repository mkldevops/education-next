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
import { Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { DialogFormActions, useDialogForm } from '@/features/forms'
import { addPhoneAction } from '../../../_lib/family-actions'

export function AddPhoneDialog({ personId }: { personId: string }) {
  const t = useTranslations('dashboard.pages.families.addPhone')

  return (
    <Dialog>
      <DialogTrigger>
        <Button size="sm">
          <Plus className="h-4 w-4" />
          {t('title')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>
        <AddPhoneForm personId={personId} />
      </DialogContent>
    </Dialog>
  )
}

function AddPhoneForm({ personId }: { personId: string }) {
  const t = useTranslations('dashboard.pages.families.addPhone')
  const { isPending, close, onSubmit } = useDialogForm(t)

  const handleSubmit = onSubmit((formData) => {
    const channels = formData.getAll('channels') as string[]
    return addPhoneAction(personId, {
      phoneNumber: formData.get('phoneNumber') as string,
      channels,
    })
  })

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phone-number">{t('phoneNumber')}</Label>
            <Input
              id="phone-number"
              name="phoneNumber"
              type="tel"
              required
              maxLength={20}
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('channels')}</Label>
            <div className="flex gap-4">
              {(['sms', 'whatsapp', 'call'] as const).map((channel) => (
                <label key={channel} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="channels" value={channel} className="rounded" />
                  {t(channel)}
                </label>
              ))}
            </div>
          </div>
        </div>
      </DialogBody>
      <DialogFormActions t={t} isPending={isPending} onCancel={close} />
    </form>
  )
}
