'use client'

import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  Textarea,
  useDialog,
} from '@peaklab/ui'
import { useTranslations } from 'next-intl'
import { useTransition } from 'react'
import { toast, toastActionError } from '@/lib/toast'
import { updateStudentAction } from '../../../_lib/student-actions'

interface EditStudentDialogProps {
  student: {
    id: string
    birthday: Date | string
    birthplace: string | null
    allergies: string | null
    healthNotes: string | null
    languagesAtHome: unknown
    snackAuthorization: boolean
  }
}

export function EditStudentDialog({ student }: EditStudentDialogProps) {
  const t = useTranslations('dashboard.pages.students.edit')

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
        <EditStudentForm student={student} />
      </DialogContent>
    </Dialog>
  )
}

function EditStudentForm({ student }: EditStudentDialogProps) {
  const t = useTranslations('dashboard.pages.students.edit')
  const tCreate = useTranslations('dashboard.pages.students.create')
  const { setOpen } = useDialog()
  const [isPending, startTransition] = useTransition()

  const birthdayStr = new Date(student.birthday).toISOString().split('T')[0]
  const languages = Array.isArray(student.languagesAtHome)
    ? (student.languagesAtHome as string[]).join(', ')
    : ''

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = await updateStudentAction(student.id, {
        birthday: new Date(formData.get('birthday') as string),
        birthplace: (formData.get('birthplace') as string) || undefined,
        allergies: (formData.get('allergies') as string) || undefined,
        healthNotes: (formData.get('healthNotes') as string) || undefined,
        languagesAtHome:
          (formData.get('languagesAtHome') as string)
            ?.split(',')
            .map((l) => l.trim())
            .filter(Boolean) ?? [],
        snackAuthorization: formData.get('snackAuthorization') === 'on',
      })
      if (typeof result === 'string') {
        toastActionError(t, result)
      } else {
        toast.success(t('success'))
        setOpen(false)
      }
    })
  }

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
                required
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
          <div className="grid grid-cols-2 gap-4">
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
              <Label htmlFor="edit-languages">{tCreate('languages')}</Label>
              <Input
                id="edit-languages"
                name="languagesAtHome"
                defaultValue={languages}
                disabled={isPending}
              />
            </div>
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
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
          {t('cancel')}
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? '...' : t('submit')}
        </Button>
      </DialogFooter>
    </form>
  )
}
