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
import { Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { DialogFormActions, useDialogForm } from '@/features/forms'
import { addPersonToFamilyAction } from '../../../_lib/family-actions'

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
        sex: formData.get('sex') as 'MALE' | 'FEMALE',
        email: (formData.get('email') as string) || undefined,
        address: (formData.get('address') as string) || undefined,
        postCode: (formData.get('postCode') as string) || undefined,
        city: (formData.get('city') as string) || undefined,
      },
      relationType: formData.get('relationType') as
        | 'PARENT'
        | 'TUTOR'
        | 'GRANDPARENT'
        | 'SIBLING'
        | 'OTHER',
      phoneNumber: (formData.get('phoneNumber') as string) || undefined,
    })
  )

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="person-name">{t('firstname')}</Label>
              <Input id="person-name" name="name" required maxLength={250} disabled={isPending} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="person-lastname">{t('lastname')}</Label>
              <Input
                id="person-lastname"
                name="lastname"
                required
                maxLength={250}
                disabled={isPending}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="person-sex">{t('sex')}</Label>
              <select
                id="person-sex"
                name="sex"
                required
                disabled={isPending}
                className="flex h-10 w-full rounded border border-alabaster bg-transparent px-3 py-2 text-sm"
              >
                <option value="MALE">{t('male')}</option>
                <option value="FEMALE">{t('female')}</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="person-relation">{t('relationType')}</Label>
              <select
                id="person-relation"
                name="relationType"
                required
                disabled={isPending}
                className="flex h-10 w-full rounded border border-alabaster bg-transparent px-3 py-2 text-sm"
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
              <Label htmlFor="person-email">{t('email')}</Label>
              <Input
                id="person-email"
                name="email"
                type="email"
                maxLength={250}
                disabled={isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="person-phone">{t('phone')}</Label>
              <Input
                id="person-phone"
                name="phoneNumber"
                type="tel"
                maxLength={20}
                disabled={isPending}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="person-address">{t('address')}</Label>
            <Input id="person-address" name="address" maxLength={250} disabled={isPending} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="person-postcode">{t('postCode')}</Label>
              <Input id="person-postcode" name="postCode" maxLength={10} disabled={isPending} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="person-city">{t('city')}</Label>
              <Input id="person-city" name="city" maxLength={250} disabled={isPending} />
            </div>
          </div>
        </div>
      </DialogBody>
      <DialogFormActions t={t} isPending={isPending} onCancel={close} />
    </form>
  )
}
