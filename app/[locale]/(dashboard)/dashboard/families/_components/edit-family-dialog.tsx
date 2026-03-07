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
  DialogTitle,
  DialogTrigger,
  useDialog,
} from '@/components/ui/dialog/dialog'
import { Input, Label, Textarea } from '@/components/ui/input/input'
import { toast } from '@/lib/toast'
import { updateFamilyAction } from '../../../_lib/family-actions'

interface EditFamilyDialogProps {
  family: {
    id: string
    name: string
    emergencyContact: string | null
    authorizedPickup: string | null
  }
}

export function EditFamilyDialog({ family }: EditFamilyDialogProps) {
  const t = useTranslations('dashboard.pages.families.edit')

  return (
    <Dialog>
      <DialogTrigger>
        <Button variant="outline" size="sm">
          {t('title')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>
        <EditFamilyForm family={family} />
      </DialogContent>
    </Dialog>
  )
}

function EditFamilyForm({ family }: EditFamilyDialogProps) {
  const t = useTranslations('dashboard.pages.families.edit')
  const tCreate = useTranslations('dashboard.pages.families.create')
  const { setOpen } = useDialog()
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = await updateFamilyAction(family.id, {
        name: formData.get('name') as string,
        emergencyContact: (formData.get('emergencyContact') as string) || undefined,
        authorizedPickup: (formData.get('authorizedPickup') as string) || undefined,
      })
      if (typeof result === 'string') {
        toast.error(t('error'))
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
            <Label htmlFor="edit-emergency">{tCreate('emergencyContact')}</Label>
            <Input
              id="edit-emergency"
              name="emergencyContact"
              defaultValue={family.emergencyContact ?? ''}
              maxLength={250}
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
