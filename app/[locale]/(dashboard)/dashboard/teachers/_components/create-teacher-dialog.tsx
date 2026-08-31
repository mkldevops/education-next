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
import { createTeacherAction } from '../../../_lib/teacher-actions'

export function CreateTeacherDialog() {
  const t = useTranslations('dashboard.pages.teachers.create')

  return (
    <Dialog>
      <DialogTrigger>
        <Button>
          <Plus className="h-4 w-4" />
          {t('title')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>
        <CreateTeacherForm />
      </DialogContent>
    </Dialog>
  )
}

function CreateTeacherForm() {
  const t = useTranslations('dashboard.pages.teachers.create')
  const { isPending, close, onSubmit } = useDialogForm(t)

  const handleSubmit = onSubmit((formData) =>
    createTeacherAction({
      firstName: formData.get('firstName') as string,
      lastName: formData.get('lastName') as string,
      email: formData.get('email') as string,
      phone: formData.get('phone') as string,
    })
  )

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="teacher-first-name">{t('firstName')}</Label>
            <Input
              id="teacher-first-name"
              name="firstName"
              required
              maxLength={250}
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="teacher-last-name">{t('lastName')}</Label>
            <Input
              id="teacher-last-name"
              name="lastName"
              required
              maxLength={250}
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="teacher-email">{t('email')}</Label>
            <Input
              id="teacher-email"
              name="email"
              type="email"
              maxLength={250}
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="teacher-phone">{t('phone')}</Label>
            <Input id="teacher-phone" name="phone" maxLength={20} disabled={isPending} />
          </div>
        </div>
      </DialogBody>
      <DialogFormActions t={t} isPending={isPending} onCancel={close} />
    </form>
  )
}
