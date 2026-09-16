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
import { useTranslations } from 'next-intl'
import { DialogFormActions, useDialogForm } from '@/features/forms'
import { revokeTeacherAccessAction, updateTeacherAction } from '../../../_lib/teacher-actions'

interface EditTeacherDialogProps {
  teacher: {
    id: string
    firstName: string
    lastName: string
    email: string | null
    phone: string | null
    userId: string | null
  }
}

export function EditTeacherDialog({ teacher }: EditTeacherDialogProps) {
  const t = useTranslations('dashboard.pages.teachers.edit')

  return (
    <Dialog>
      <DialogTrigger>
        <Button variant="outline" size="sm">
          {t('title')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>
        <EditTeacherForm teacher={teacher} />
      </DialogContent>
    </Dialog>
  )
}

function EditTeacherForm({ teacher }: EditTeacherDialogProps) {
  const t = useTranslations('dashboard.pages.teachers.edit')
  const tCreate = useTranslations('dashboard.pages.teachers.create')
  const { isPending, close, onSubmit, run } = useDialogForm(t)

  const handleSubmit = onSubmit((formData) =>
    updateTeacherAction(teacher.id, {
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
            <Label htmlFor="edit-teacher-first-name">{tCreate('firstName')}</Label>
            <Input
              id="edit-teacher-first-name"
              name="firstName"
              defaultValue={teacher.firstName}
              required
              maxLength={250}
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-teacher-last-name">{tCreate('lastName')}</Label>
            <Input
              id="edit-teacher-last-name"
              name="lastName"
              defaultValue={teacher.lastName}
              required
              maxLength={250}
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-teacher-email">{tCreate('email')}</Label>
            <Input
              id="edit-teacher-email"
              name="email"
              type="email"
              defaultValue={teacher.email ?? ''}
              maxLength={250}
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-teacher-phone">{tCreate('phone')}</Label>
            <Input
              id="edit-teacher-phone"
              name="phone"
              defaultValue={teacher.phone ?? ''}
              maxLength={20}
              disabled={isPending}
            />
          </div>
        </div>
      </DialogBody>
      <DialogFormActions t={t} isPending={isPending} onCancel={close} />
      {teacher.userId && (
        <div className="px-6 pb-6">
          <Button
            type="button"
            variant="destructive"
            disabled={isPending}
            onClick={() =>
              run(() => revokeTeacherAccessAction(teacher.id), { successKey: 'accessRevoked' })
            }
          >
            {t('revokeAccess')}
          </Button>
        </div>
      )}
    </form>
  )
}
