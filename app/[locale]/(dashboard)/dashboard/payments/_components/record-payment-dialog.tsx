'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useTransition } from 'react'
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
import { useRouter } from '@/i18n/routing'
import { toast } from '@/lib/toast'
import { recordPaymentAction } from '../../../_lib/payment-actions'

interface Option {
  id: string
  name: string
}

export function RecordPaymentDialog({
  families,
  defaultOpen = false,
}: {
  families: Option[]
  defaultOpen?: boolean
}) {
  const t = useTranslations('dashboard.pages.payments.record')

  return (
    <Dialog initialOpen={defaultOpen}>
      <DialogTrigger>
        <Button>+ {t('title')}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>
        <RecordPaymentForm families={families} defaultOpen={defaultOpen} />
      </DialogContent>
    </Dialog>
  )
}

function RecordPaymentForm({
  families,
  defaultOpen = false,
}: {
  families: Option[]
  defaultOpen?: boolean
}) {
  const t = useTranslations('dashboard.pages.payments.record')
  const { setOpen } = useDialog()
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  useEffect(() => {
    if (defaultOpen) {
      setOpen(true)
      router.replace('/dashboard/payments')
    }
  }, [defaultOpen, setOpen, router])

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = await recordPaymentAction({
        familyId: formData.get('familyId') as string,
        amount: Number(formData.get('amount')),
        method: formData.get('method') as 'CASH' | 'CARD' | 'TRANSFER' | 'CHECK' | 'STRIPE',
        reference: (formData.get('reference') as string) || undefined,
        paidAt: new Date(formData.get('paidAt') as string),
        cashedAt: (formData.get('cashedAt') as string)
          ? new Date(formData.get('cashedAt') as string)
          : undefined,
      })
      if (typeof result === 'string') {
        toast.error(t('error'))
      } else {
        toast.success(t('success'))
        setOpen(false)
        router.refresh()
      }
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="payment-family">{t('selectFamily')}</Label>
            <select
              id="payment-family"
              name="familyId"
              required
              disabled={isPending}
              className="flex h-10 w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm"
            >
              {families.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="payment-amount">{t('amount')}</Label>
              <Input
                id="payment-amount"
                name="amount"
                type="number"
                step="0.01"
                required
                disabled={isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment-method">{t('method')}</Label>
              <select
                id="payment-method"
                name="method"
                required
                disabled={isPending}
                className="flex h-10 w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm"
              >
                <option value="CASH">{t('methods.CASH')}</option>
                <option value="CARD">{t('methods.CARD')}</option>
                <option value="TRANSFER">{t('methods.TRANSFER')}</option>
                <option value="CHECK">{t('methods.CHECK')}</option>
                <option value="STRIPE">{t('methods.STRIPE')}</option>
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="payment-reference">{t('reference')}</Label>
            <Input id="payment-reference" name="reference" maxLength={250} disabled={isPending} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="payment-paidAt">{t('paidAt')}</Label>
              <Input
                id="payment-paidAt"
                name="paidAt"
                type="date"
                required
                defaultValue={new Date().toISOString().split('T')[0]}
                disabled={isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment-cashedAt">{t('cashedAt')}</Label>
              <Input id="payment-cashedAt" name="cashedAt" type="date" disabled={isPending} />
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
