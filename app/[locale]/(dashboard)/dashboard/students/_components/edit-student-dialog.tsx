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
  Textarea,
} from '@peaklab/ui'
import { useTranslations } from 'next-intl'
import { DialogFormActions, useDialogForm } from '@/features/forms'
import { updateStudentAction } from '../../../_lib/student-actions'

interface EditStudentDialogProps {
  student: {
    id: string
    birthday: Date | string | null
    birthplace: string | null
    allergies: string | null
    healthNotes: string | null
    snackAuthorization: boolean
  }
  triggerRole?: React.AriaRole
  restoreFocusRef?: React.RefObject<HTMLElement | null>
}

export function EditStudentDialog({ student, triggerRole }: EditStudentDialogProps) {
  const t = useTranslations('dashboard.pages.students.edit')

  return (
    <Dialog>
      <DialogTrigger>
        <Button variant="outline" size="sm" role={triggerRole}>
          {t('title')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>
        <EditStudentForm student={student} />
      </DialogContent>
    </Dialog>
  )
}

function EditStudentForm({ student }: EditStudentDialogProps) {
  const t = useTranslations('dashboard.pages.students.edit')
  const tCreate = useTranslations('dashboard.pages.students.create')
  const { isPending, close, onSubmit } = useDialogForm(t)

  const birthdayStr = student.birthday ? new Date(student.birthday).toISOString().split('T')[0] : ''

  const handleSubmit = onSubmit((formData) =>
    updateStudentAction(student.id, {
      birthday: formData.get('birthday') ? new Date(formData.get('birthday') as string) : null,
      birthplace: (formData.get('birthplace') as string) || undefined,
      allergies: (formData.get('allergies') as string) || undefined,
      healthNotes: (formData.get('healthNotes') as string) || undefined,
      snackAuthorization: formData.get('snackAuthorization') === 'on',
    })
  )

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-birthday">{tCreate('birthday')}</Label>
              <Input
                id="edit-birthday"
                name="birthday"
                type="date"
                defaultValue={birthdayStr}
                disabled={isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-birthplace">{tCreate('birthplace')}</Label>
              <Input
                id="edit-birthplace"
                name="birthplace"
                defaultValue={student.birthplace ?? ''}
                maxLength={250}
                disabled={isPending}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-allergies">{tCreate('allergies')}</Label>
            <Input
              id="edit-allergies"
              name="allergies"
              defaultValue={student.allergies ?? ''}
              maxLength={250}
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-health">{tCreate('healthNotes')}</Label>
            <Textarea
              id="edit-health"
              name="healthNotes"
              defaultValue={student.healthNotes ?? ''}
              disabled={isPending}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="snackAuthorization"
              defaultChecked={student.snackAuthorization}
              className="rounded"
            />
            {tCreate('snackAuthorization')}
          </label>
        </div>
      </DialogBody>
      <DialogFormActions t={t} isPending={isPending} onCancel={close} />
    </form>
  )
}
