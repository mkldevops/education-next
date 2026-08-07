'use client'

import { useTranslations } from 'next-intl'
import { useTransition } from 'react'
import { Button } from '@/components/ui/button/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRouteOpener,
  DialogTitle,
  DialogTrigger,
  useDialog,
} from '@/components/ui/dialog/dialog'
import { Input, Label, Textarea } from '@/components/ui/input/input'
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
  const { setOpen } = useDialog()
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)

    const clearable = (field: string) => (formData.get(field) as string)?.trim() || null

    const parsed = updateFamilySchema.safeParse({
      id: family.id,
      name: formData.get('name') as string,
      emergencyContactName: clearable('emergencyContactName'),
      emergencyContactPhone: clearable('emergencyContactPhone'),
      authorizedPickup: clearable('authorizedPickup'),
    })
    if (!parsed.success) {
      const invalidPhone = parsed.error.issues.some(
        (issue) => issue.path[0] === 'emergencyContactPhone'
      )
      toast.error(invalidPhone ? tCreate('emergencyContactPhoneInvalid') : t('error'))
      return
    }

    const { id, ...data } = parsed.data

    startTransition(async () => {
      const result = await updateFamilyAction(id, data)
      if (typeof result === 'string') {
        toast.error(t.has(`errors.${result}`) ? t(`errors.${result}`) : t('error'))
      } else {
        toast.success(t('success'))
        setOpen(false)
      }
    })
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
        </div>
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
          {t('cancel')}
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? '...' : t('submit')}
        </Button>
      </DialogFooter>
    </form>
  )
}
