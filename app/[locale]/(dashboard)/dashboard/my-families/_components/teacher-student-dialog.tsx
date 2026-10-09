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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@peaklab/ui'
import { Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { DialogFormActions, useDialogForm } from '@/features/forms'
import { useRouter } from '@/i18n/routing'
import { createStudentAsTeacherAction } from '../../../_lib/teacher-family-actions'

export function TeacherStudentDialog({ familyId }: { familyId: string }) {
  const t = useTranslations('dashboard.pages.myFamilies.createStudent')

  return (
    <Dialog>
      <DialogTrigger>
        <Button size="sm" variant="outline">
          <Plus className="h-4 w-4" />
          {t('title')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>
        <TeacherStudentForm familyId={familyId} />
      </DialogContent>
    </Dialog>
  )
}

function TeacherStudentForm({ familyId }: { familyId: string }) {
  const t = useTranslations('dashboard.pages.myFamilies.createStudent')
  const { isPending, close, onSubmit } = useDialogForm(t)
  const router = useRouter()
  const sexItems = [
    { value: null, label: t('unspecified') },
    { value: 'MALE', label: t('male') },
    { value: 'FEMALE', label: t('female') },
  ]

  const handleSubmit = onSubmit(
    (formData) =>
      createStudentAsTeacherAction({
        familyId,
        person: {
          name: formData.get('name') as string,
          lastname: formData.get('lastname') as string,
          sex: (formData.get('sex') as 'MALE' | 'FEMALE' | '') || undefined,
        },
        student: {
          birthday: formData.get('birthday')
            ? new Date(formData.get('birthday') as string)
            : undefined,
          allergies: (formData.get('allergies') as string) || undefined,
        },
      }),
    { onSuccess: () => router.refresh() }
  )

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="teacher-student-name">{t('firstname')}</Label>
              <Input
                id="teacher-student-name"
                name="name"
                required
                maxLength={250}
                disabled={isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="teacher-student-lastname">{t('lastname')}</Label>
              <Input
                id="teacher-student-lastname"
                name="lastname"
                required
                maxLength={250}
                disabled={isPending}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="teacher-student-sex">{t('sex')}</Label>
              <Select name="sex" items={sexItems} disabled={isPending} defaultValue={null}>
                <SelectTrigger id="teacher-student-sex">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sexItems.map((item) => (
                    <SelectItem key={item.value ?? ''} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="teacher-student-birthday">{t('birthday')}</Label>
              <Input
                id="teacher-student-birthday"
                name="birthday"
                type="date"
                disabled={isPending}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="teacher-student-allergies">{t('allergies')}</Label>
            <Input
              id="teacher-student-allergies"
              name="allergies"
              maxLength={250}
              disabled={isPending}
            />
          </div>
        </div>
      </DialogBody>
      <DialogFormActions t={t} isPending={isPending} onCancel={close} />
    </form>
  )
}
