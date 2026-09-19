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
import type { RelationType, Sex } from '@/generated/prisma/client'
import { addPersonToFamilyAction } from '../../../_lib/family-actions'
import { PersonFields } from './person-fields'

export function AddPersonDialog({ familyId }: { familyId: string }) {
  const t = useTranslations('dashboard.pages.families.addPerson')

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
        <AddPersonForm familyId={familyId} />
      </DialogContent>
    </Dialog>
  )
}

function AddPersonForm({ familyId }: { familyId: string }) {
  const t = useTranslations('dashboard.pages.families.addPerson')
  const { isPending, close, onSubmit } = useDialogForm(t)

  const handleSubmit = onSubmit((formData) =>
    addPersonToFamilyAction({
      familyId,
      person: {
        name: formData.get('name') as string,
        lastname: formData.get('lastname') as string,
        sex: (formData.get('sex') as Sex | '') || undefined,
        email: (formData.get('email') as string) || undefined,
        address: (formData.get('address') as string) || undefined,
        postCode: (formData.get('postCode') as string) || undefined,
        city: (formData.get('city') as string) || undefined,
      },
      relationType: formData.get('relationType') as RelationType,
      phoneNumber: (formData.get('phoneNumber') as string) || undefined,
    })
  )

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody>
        <PersonFields t={t} idPrefix="person" isPending={isPending} />
      </DialogBody>
      <DialogFormActions t={t} isPending={isPending} onCancel={close} />
    </form>
  )
}
