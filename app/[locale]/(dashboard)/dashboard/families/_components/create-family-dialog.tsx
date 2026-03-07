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
import { createFamilySchema } from '@/use-cases/families/schemas'
import { createFamilyAction } from '../../../_lib/family-actions'

export function CreateFamilyDialog() {
  const t = useTranslations('dashboard.pages.families.create')

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>+ {t('title')}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>
        <CreateFamilyForm />
      </DialogContent>
    </Dialog>
  )
}

function CreateFamilyForm() {
  const t = useTranslations('dashboard.pages.families.create')
  const { setOpen } = useDialog()
  const [isPending, startTransition] = useTransition()

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    const formData = new FormData(e.currentTarget)
    const rawData = {
      name: formData.get('name') as string,
      emergencyContact: (formData.get('emergencyContact') as string) || undefined,
      authorizedPickup: (formData.get('authorizedPickup') as string) || undefined,
    }

    const parsed = createFamilySchema.safeParse(rawData)
    if (!parsed.success) {
      toast.error(t('error'))
      return
    }

    startTransition(async () => {
      const result = await createFamilyAction(parsed.data)
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
            <Label htmlFor="name">{t('name')}</Label>
            <Input
              id="name"
              name="name"
              type="text"
              placeholder="Family name"
              required
              maxLength={50}
              disabled={isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="emergencyContact">{t('emergencyContact')}</Label>
            <Input
              id="emergencyContact"
              name="emergencyContact"
              type="text"
              placeholder="Contact name and phone"
              maxLength={250}
              disabled={isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="authorizedPickup">{t('authorizedPickup')}</Label>
            <Textarea
              id="authorizedPickup"
              name="authorizedPickup"
              placeholder="Names of authorized persons..."
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
