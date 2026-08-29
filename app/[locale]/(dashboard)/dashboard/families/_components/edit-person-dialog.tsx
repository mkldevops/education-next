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
import { Pencil } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { DialogFormActions, useDialogForm } from '@/features/forms'
import { updateFamilyPersonAction } from '../../../_lib/family-actions'

type RelationType = 'PARENT' | 'TUTOR' | 'GRANDPARENT' | 'SIBLING' | 'OTHER'

export interface EditablePerson {
  id: string
  name: string
  lastname: string
  sex: 'MALE' | 'FEMALE'
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
      sex: formData.get('sex') as 'MALE' | 'FEMALE',
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
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-person-name">{t('firstname')}</Label>
              <Input
                id="edit-person-name"
                name="name"
                required
                maxLength={250}
                defaultValue={person.name}
                disabled={isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-person-lastname">{t('lastname')}</Label>
              <Input
                id="edit-person-lastname"
                name="lastname"
                required
                maxLength={250}
                defaultValue={person.lastname}
                disabled={isPending}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-person-sex">{t('sex')}</Label>
              <select
                id="edit-person-sex"
                name="sex"
                required
                defaultValue={person.sex}
                disabled={isPending}
                className="flex h-10 w-full rounded border border-gray-300 bg-transparent px-3 py-2 text-sm"
              >
                <option value="MALE">{t('male')}</option>
                <option value="FEMALE">{t('female')}</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-person-relation">{t('relationType')}</Label>
              <select
                id="edit-person-relation"
                name="relationType"
                required
                defaultValue={person.relationType}
                disabled={isPending}
                className="flex h-10 w-full rounded border border-gray-300 bg-transparent px-3 py-2 text-sm"
              >
                <option value="PARENT">{t('parent')}</option>
                <option value="TUTOR">{t('tutor')}</option>
                <option value="GRANDPARENT">{t('grandparent')}</option>
                <option value="SIBLING">{t('sibling')}</option>
                <option value="OTHER">{t('other')}</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-person-email">{t('email')}</Label>
              <Input
                id="edit-person-email"
                name="email"
                type="email"
                maxLength={250}
                defaultValue={person.email ?? ''}
                disabled={isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-person-phone">{t('phone')}</Label>
              <Input
                id="edit-person-phone"
                name="phoneNumber"
                type="tel"
                maxLength={20}
                defaultValue={person.phoneNumber ?? ''}
                disabled={isPending}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-person-address">{t('address')}</Label>
            <Input
              id="edit-person-address"
              name="address"
              maxLength={250}
              defaultValue={person.address ?? ''}
              disabled={isPending}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-person-postcode">{t('postCode')}</Label>
              <Input
                id="edit-person-postcode"
                name="postCode"
                maxLength={10}
                defaultValue={person.postCode ?? ''}
                disabled={isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-person-city">{t('city')}</Label>
              <Input
                id="edit-person-city"
                name="city"
                maxLength={250}
                defaultValue={person.city ?? ''}
                disabled={isPending}
              />
            </div>
          </div>
        </div>
      </DialogBody>
      <DialogFormActions t={t} isPending={isPending} onCancel={close} />
    </form>
  )
}
