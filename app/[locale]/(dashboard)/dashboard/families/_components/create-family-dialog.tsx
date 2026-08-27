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
  Textarea,
  useDialog,
} from '@peaklab/ui'
import { Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect } from 'react'
import { DialogFormActions, useDialogForm } from '@/features/forms'
import { useRouter } from '@/i18n/routing'
import { toast } from '@/lib/toast'
import { createFamilySchema } from '@/use-cases/families/schemas'
import { createFamilyAction } from '../../../_lib/family-actions'

function RequiredMark() {
  return (
    <span aria-hidden className="text-red-500">
      {' '}
      *
    </span>
  )
}

export function CreateFamilyDialog({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const t = useTranslations('dashboard.pages.families.create')

  return (
    <Dialog initialOpen={defaultOpen}>
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
        <CreateFamilyForm defaultOpen={defaultOpen} />
      </DialogContent>
    </Dialog>
  )
}

function CreateFamilyForm({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const t = useTranslations('dashboard.pages.families.create')
  const { setOpen } = useDialog()
  const { isPending, close, run } = useDialogForm(t)
  const router = useRouter()

  useEffect(() => {
    if (defaultOpen) {
      setOpen(true)
      router.replace('/dashboard/families')
    }
  }, [defaultOpen, setOpen, router])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    const formData = new FormData(e.currentTarget)
    const rawData = {
      name: formData.get('name') as string,
      emergencyContactName: (formData.get('emergencyContactName') as string) || undefined,
      emergencyContactPhone: (formData.get('emergencyContactPhone') as string) || undefined,
      authorizedPickup: (formData.get('authorizedPickup') as string) || undefined,
      parents: [],
    }

    const parsed = createFamilySchema.omit({ schoolId: true }).safeParse(rawData)
    if (!parsed.success) {
      const invalidPhone = parsed.error.issues.some(
        (issue) => issue.path[0] === 'emergencyContactPhone'
      )
      toast.error(invalidPhone ? t('emergencyContactPhoneInvalid') : t('error'))
      return
    }

    run(() => createFamilyAction(parsed.data), {
      onSuccess: (family) => router.push(`/dashboard/families/${family.id}`),
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">
              {t('name')}
              <RequiredMark />
            </Label>
            <Input
              id="name"
              name="name"
              type="text"
              placeholder={t('namePlaceholder')}
              required
              maxLength={50}
              disabled={isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="emergencyContactName">{t('emergencyContactName')}</Label>
            <Input
              id="emergencyContactName"
              name="emergencyContactName"
              type="text"
              placeholder={t('emergencyContactNamePlaceholder')}
              maxLength={250}
              disabled={isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="emergencyContactPhone">{t('emergencyContactPhone')}</Label>
            <Input
              id="emergencyContactPhone"
              name="emergencyContactPhone"
              type="tel"
              placeholder={t('emergencyContactPhonePlaceholder')}
              maxLength={20}
              disabled={isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="authorizedPickup">{t('authorizedPickup')}</Label>
            <Textarea
              id="authorizedPickup"
              name="authorizedPickup"
              placeholder={t('authorizedPickupPlaceholder')}
              disabled={isPending}
            />
          </div>

          <p className="rounded border border-teal-200 bg-teal-50 p-3 text-sm text-teal-900">
            {t('nextStepHint')}
          </p>
        </div>
      </DialogBody>

      <DialogFormActions t={t} isPending={isPending} onCancel={close} />
    </form>
  )
}
