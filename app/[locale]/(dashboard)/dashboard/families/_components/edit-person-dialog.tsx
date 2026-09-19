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
import { Pencil } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { DialogFormActions, useDialogForm } from '@/features/forms'
import type { RelationType, Sex } from '@/generated/prisma/client'
import { updateFamilyPersonAction } from '../../../_lib/family-actions'
import { PersonFields } from './person-fields'

export interface EditablePerson {
  id: string
  name: string
  lastname: string
  sex: Sex | null
  email: string | null
  address: string | null
  postCode: string | null
  city: string | null
  relationType: RelationType
  phoneNumber: string | null
}

interface EditPersonDialogProps {
  familyId: string
  person: EditablePerson
}

export function EditPersonDialog({ familyId, person }: EditPersonDialogProps) {
  const t = useTranslations('dashboard.pages.families.editPerson')

  return (
    <Dialog>
      <DialogTrigger>
        <Button variant="outline" size="sm">
          <Pencil className="h-4 w-4" />
          {t('title')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>
        <EditPersonForm familyId={familyId} person={person} />
      </DialogContent>
    </Dialog>
  )
}

const optionalField = (formData: FormData, key: string) => {
  const value = (formData.get(key) as string).trim()
  return value === '' ? null : value
}

function EditPersonForm({ familyId, person }: EditPersonDialogProps) {
  const t = useTranslations('dashboard.pages.families.editPerson')
  const { isPending, close, onSubmit } = useDialogForm(t)

  const handleSubmit = onSubmit((formData) =>
    updateFamilyPersonAction({
      familyId,
      personId: person.id,
      name: formData.get('name') as string,
      lastname: formData.get('lastname') as string,
      sex: optionalField(formData, 'sex') as Sex | null,
      relationType: formData.get('relationType') as RelationType,
      email: optionalField(formData, 'email'),
      address: optionalField(formData, 'address'),
      postCode: optionalField(formData, 'postCode'),
      city: optionalField(formData, 'city'),
      phoneNumber: optionalField(formData, 'phoneNumber'),
    })
  )

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody>
        <PersonFields t={t} idPrefix="edit-person" isPending={isPending} defaults={person} />
      </DialogBody>
      <DialogFormActions t={t} isPending={isPending} onCancel={close} />
    </form>
  )
}
