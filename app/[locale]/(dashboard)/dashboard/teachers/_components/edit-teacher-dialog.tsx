'use client'

import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@peaklab/ui'
import { useTranslations } from 'next-intl'
import { DialogFormActions, useDialogForm } from '@/features/forms'
import { revokeTeacherAccessAction, updateTeacherAction } from '../../../_lib/teacher-actions'
import { readTeacherInput, TeacherFields } from './teacher-fields'

interface EditTeacherDialogProps {
  teacher: {
    id: string
    firstName: string
    lastName: string
    email: string | null
    phone: string | null
    userId: string | null
  }
  triggerRole?: React.AriaRole
  restoreFocusRef?: React.RefObject<HTMLElement | null>
}

export function EditTeacherDialog({
  teacher,
  triggerRole,
  restoreFocusRef,
}: EditTeacherDialogProps) {
  const t = useTranslations('dashboard.pages.teachers.edit')

  return (
    <Dialog restoreFocusRef={restoreFocusRef}>
      <DialogTrigger>
        <Button variant="outline" size="sm" role={triggerRole}>
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
  const { isPending, close, onSubmit, run } = useDialogForm(t)

  const handleSubmit = onSubmit((formData) =>
    updateTeacherAction(teacher.id, readTeacherInput(formData))
  )

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody>
        <TeacherFields idPrefix="edit-teacher" disabled={isPending} defaults={teacher} />
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
