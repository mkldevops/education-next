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
import { toast, toastActionError } from '@/lib/toast'
import { updatePlanAction } from '../../../_lib/plan-actions'

interface EditPlanDialogProps {
  plan: {
    id: string
    name: string
    amount: number
  }
}

export function EditPlanDialog({ plan }: EditPlanDialogProps) {
  const t = useTranslations('dashboard.pages.plans.edit')

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
        <EditPlanForm plan={plan} />
      </DialogContent>
    </Dialog>
  )
}

function EditPlanForm({ plan }: EditPlanDialogProps) {
  const t = useTranslations('dashboard.pages.plans.edit')
  const tCreate = useTranslations('dashboard.pages.plans.create')
  const { setOpen } = useDialog()
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = await updatePlanAction(plan.id, {
        name: formData.get('name') as string,
        amount: Number(formData.get('amount')),
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
            <Label htmlFor="edit-plan-name">{tCreate('name')}</Label>
            <Input
              id="edit-plan-name"
              name="name"
              defaultValue={plan.name}
              required
              maxLength={50}
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-plan-amount">{tCreate('amount')}</Label>
            <Input
              id="edit-plan-amount"
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              defaultValue={plan.amount}
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
