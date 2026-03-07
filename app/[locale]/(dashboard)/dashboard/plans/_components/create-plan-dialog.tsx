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
import { createPlanAction } from '../../../_lib/plan-actions'

export function CreatePlanDialog() {
  const t = useTranslations('dashboard.pages.plans.create')

  return (
    <Dialog>
      <DialogTrigger>
        <Button>+ {t('title')}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>
        <CreatePlanForm />
      </DialogContent>
    </Dialog>
  )
}

function CreatePlanForm() {
  const t = useTranslations('dashboard.pages.plans.create')
  const { setOpen } = useDialog()
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = await createPlanAction({
        name: formData.get('name') as string,
        amount: Number(formData.get('amount')),
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
            <Label htmlFor="plan-name">{t('name')}</Label>
            <Input id="plan-name" name="name" required maxLength={50} disabled={isPending} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="plan-amount">{t('amount')}</Label>
            <Input
              id="plan-amount"
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              required
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
