'use client'

import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogRouteOpener,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  Textarea,
} from '@peaklab/ui'
import { useTranslations } from 'next-intl'
import { languagesOf, parseLanguagesAtHome } from '@/domain/family'
import { DialogFormActions, useDialogForm } from '@/features/forms'
import { toast } from '@/lib/toast'
import { updateFamilySchema } from '@/use-cases/families/schemas'
import { updateFamilyAction } from '../../../_lib/family-actions'

interface EditFamilyDialogProps {
  family: {
    id: string
    name: string
    emergencyContactName: string | null
    emergencyContactPhone: string | null
    authorizedPickup: string | null
    languagesAtHome: unknown
  }
  defaultOpen?: boolean
  redirectTo?: string
  showTrigger?: boolean
}

export function EditFamilyDialog({
  family,
  defaultOpen = false,
  redirectTo,
  showTrigger = true,
}: EditFamilyDialogProps) {
  const t = useTranslations('dashboard.pages.families.edit')

  return (
    <Dialog initialOpen={defaultOpen}>
      <DialogRouteOpener open={defaultOpen} cleanUrl={redirectTo} />
      {showTrigger && (
        <DialogTrigger>
          <Button variant="outline" size="sm">
            {t('title')}
          </Button>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>
        <EditFamilyForm family={family} />
      </DialogContent>
    </Dialog>
  )
}

function EditFamilyForm({ family }: Pick<EditFamilyDialogProps, 'family'>) {
  const t = useTranslations('dashboard.pages.families.edit')
  const tCreate = useTranslations('dashboard.pages.families.create')
  const { isPending, close, run } = useDialogForm(t)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)

    const clearable = (field: string) => (formData.get(field) as string)?.trim() || null

    const parsed = updateFamilySchema.omit({ schoolId: true }).safeParse({
      id: family.id,
      name: formData.get('name') as string,
      emergencyContactName: clearable('emergencyContactName'),
      emergencyContactPhone: clearable('emergencyContactPhone'),
      authorizedPickup: clearable('authorizedPickup'),
      languagesAtHome: parseLanguagesAtHome(formData.get('languagesAtHome') as string),
    })
    if (!parsed.success) {
      const invalidPhone = parsed.error.issues.some(
        (issue) => issue.path[0] === 'emergencyContactPhone'
      )
      toast.error(invalidPhone ? tCreate('emergencyContactPhoneInvalid') : t('error'))
      return
    }

    const { id, ...data } = parsed.data

    run(() => updateFamilyAction(id, data))
  }

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">{tCreate('name')}</Label>
            <Input
              id="edit-name"
              name="name"
              defaultValue={family.name}
              required
              maxLength={50}
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-emergency-name">{tCreate('emergencyContactName')}</Label>
            <Input
              id="edit-emergency-name"
              name="emergencyContactName"
              defaultValue={family.emergencyContactName ?? ''}
              placeholder={tCreate('emergencyContactNamePlaceholder')}
              maxLength={250}
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-emergency-phone">{tCreate('emergencyContactPhone')}</Label>
            <Input
              id="edit-emergency-phone"
              name="emergencyContactPhone"
              type="tel"
              defaultValue={family.emergencyContactPhone ?? ''}
              placeholder={tCreate('emergencyContactPhonePlaceholder')}
              maxLength={20}
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-pickup">{tCreate('authorizedPickup')}</Label>
            <Textarea
              id="edit-pickup"
              name="authorizedPickup"
              defaultValue={family.authorizedPickup ?? ''}
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-languages">{tCreate('languagesAtHome')}</Label>
            <Input
              id="edit-languages"
              name="languagesAtHome"
              defaultValue={languagesOf(family.languagesAtHome).join(', ')}
              placeholder={tCreate('languagesAtHomePlaceholder')}
              disabled={isPending}
            />
          </div>
        </div>
      </DialogBody>
      <DialogFormActions t={t} isPending={isPending} onCancel={close} />
    </form>
  )
}
