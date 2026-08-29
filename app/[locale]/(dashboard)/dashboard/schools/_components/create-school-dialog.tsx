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
import { createSchoolAction } from '../../../_lib/school-admin-actions'
import { readSchoolIdentity, SchoolIdentityFields } from './school-identity-fields'

export function CreateSchoolDialog() {
  const t = useTranslations('schools.admin.create')

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
        <CreateSchoolForm />
      </DialogContent>
    </Dialog>
  )
}

function CreateSchoolForm() {
  const t = useTranslations('schools.admin.create')
  const { isPending, close, onSubmit } = useDialogForm(t)

  const handleSubmit = onSubmit((formData) => createSchoolAction(readSchoolIdentity(formData)))

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody>
        <SchoolIdentityFields idPrefix="create-school" disabled={isPending} />
      </DialogBody>
      <DialogFormActions t={t} isPending={isPending} onCancel={close} />
    </form>
  )
}
