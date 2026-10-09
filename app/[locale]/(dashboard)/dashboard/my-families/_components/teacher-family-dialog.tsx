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
import { useRouter } from '@/i18n/routing'
import { createFamilyAsTeacherAction } from '../../../_lib/teacher-family-actions'

const optional = (value: FormDataEntryValue | null) => (value as string)?.trim() || undefined

export function TeacherFamilyDialog() {
  const t = useTranslations('dashboard.pages.myFamilies.createFamily')

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
        <TeacherFamilyForm />
      </DialogContent>
    </Dialog>
  )
}

function TeacherFamilyForm() {
  const t = useTranslations('dashboard.pages.myFamilies.createFamily')
  const { isPending, close, onSubmit } = useDialogForm(t)
  const router = useRouter()

  const handleSubmit = onSubmit(
    (formData) =>
      createFamilyAsTeacherAction({
        name: formData.get('name') as string,
        parents: [
          {
            name: formData.get('parentName') as string,
            lastname: formData.get('parentLastname') as string,
            email: optional(formData.get('parentEmail')),
            phoneNumber: optional(formData.get('parentPhone')),
          },
        ],
      }),
    { onSuccess: () => router.refresh() }
  )

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="teacher-family-name">{t('name')}</Label>
            <Input
              id="teacher-family-name"
              name="name"
              required
              maxLength={50}
              disabled={isPending}
            />
          </div>
          <p className="text-sm font-medium text-graphite">{t('parent')}</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="teacher-parent-name">{t('firstname')}</Label>
              <Input
                id="teacher-parent-name"
                name="parentName"
                required
                maxLength={250}
                disabled={isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="teacher-parent-lastname">{t('lastname')}</Label>
              <Input
                id="teacher-parent-lastname"
                name="parentLastname"
                required
                maxLength={250}
                disabled={isPending}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="teacher-parent-phone">{t('phone')}</Label>
              <Input
                id="teacher-parent-phone"
                name="parentPhone"
                type="tel"
                maxLength={20}
                disabled={isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="teacher-parent-email">{t('email')}</Label>
              <Input
                id="teacher-parent-email"
                name="parentEmail"
                type="email"
                maxLength={250}
                disabled={isPending}
              />
            </div>
          </div>
          <p className="rounded border border-teal-200 bg-teal-50 p-3 text-sm text-teal-900">
            {t('hint')}
          </p>
        </div>
      </DialogBody>
      <DialogFormActions t={t} isPending={isPending} onCancel={close} />
    </form>
  )
}
