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
import { Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { DialogFormActions, useDialogForm } from '@/features/forms'
import { toast } from '@/lib/toast'
import { createTeacherAction } from '../../../_lib/teacher-actions'
import { readTeacherInput, TeacherFields } from './teacher-fields'

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

  const handleSubmit = onSubmit(
    (formData) => {
      const input = readTeacherInput(formData)
      const invite = formData.get('invite') === 'on' && Boolean(input.email)
      return createTeacherAction(input, { invite })
    },
    {
      onSuccess: (teacher) => {
        if ('invitationSent' in teacher && !teacher.invitationSent) {
          toast.warning(t('errors.invitationFailed'))
        }
      },
    }
  )

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody>
        <div className="space-y-4">
          <TeacherFields idPrefix="teacher" disabled={isPending} />
          <label className="flex items-start gap-2 text-sm text-graphite">
            <input
              type="checkbox"
              name="invite"
              defaultChecked
              className="mt-0.5 rounded"
              disabled={isPending}
            />
            <span>
              <span className="font-medium">{t('invite')}</span>
              <span className="block text-xs text-graphite-600">{t('inviteHint')}</span>
            </span>
          </label>
        </div>
      </DialogBody>
      <DialogFormActions t={t} isPending={isPending} onCancel={close} />
    </form>
  )
}
