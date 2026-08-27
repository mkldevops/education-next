'use client'

import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  useDialog,
} from '@peaklab/ui'
import { Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useTransition } from 'react'
import { toast, toastActionError } from '@/lib/toast'
import { addPhoneAction } from '../../../_lib/family-actions'

export function AddPhoneDialog({ personId }: { personId: string }) {
  const t = useTranslations('dashboard.pages.families.addPhone')

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
        <AddPhoneForm personId={personId} />
      </DialogContent>
    </Dialog>
  )
}

function AddPhoneForm({ personId }: { personId: string }) {
  const t = useTranslations('dashboard.pages.families.addPhone')
  const { setOpen } = useDialog()
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const channels = formData.getAll('channels') as string[]

    startTransition(async () => {
      const result = await addPhoneAction(personId, {
        phoneNumber: formData.get('phoneNumber') as string,
        channels,
      })
      if (typeof result === 'string') {
        toastActionError(t, result)
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
            <Label htmlFor="phone-number">{t('phoneNumber')}</Label>
            <Input
              id="phone-number"
              name="phoneNumber"
              type="tel"
              required
              maxLength={20}
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('channels')}</Label>
            <div className="flex gap-4">
              {(['sms', 'whatsapp', 'call'] as const).map((channel) => (
                <label key={channel} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="channels" value={channel} className="rounded" />
                  {t(channel)}
                </label>
              ))}
            </div>
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
