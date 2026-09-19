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

  const handleSubmit = onSubmit((formData) => createTeacherAction(readTeacherInput(formData)))

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody>
        <TeacherFields idPrefix="teacher" disabled={isPending} />
      </DialogBody>
      <DialogFormActions t={t} isPending={isPending} onCancel={close} />
    </form>
  )
}
