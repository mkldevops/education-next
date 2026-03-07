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
import { Input, Label } from '@/components/ui/input/input'
import { toast } from '@/lib/toast'
import { createLevelAction } from '../../../_lib/level-actions'

export function CreateLevelDialog() {
  const t = useTranslations('dashboard.pages.levels.create')

  return (
    <Dialog>
      <DialogTrigger>
        <Button>+ {t('title')}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>
        <CreateLevelForm />
      </DialogContent>
    </Dialog>
  )
}

function CreateLevelForm() {
  const t = useTranslations('dashboard.pages.levels.create')
  const { setOpen } = useDialog()
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = await createLevelAction({
        name: formData.get('name') as string,
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
            <Label htmlFor="level-name">{t('name')}</Label>
            <Input
              id="level-name"
              name="name"
              required
              maxLength={250}
              placeholder="CP, CE1, CE2..."
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
