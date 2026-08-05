'use client'

import type { LucideIcon } from 'lucide-react'
import { ArrowLeftRight, Banknote, CreditCard, FileCheck } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
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
import { Input, Label } from '@/components/ui/input/input'
import { cn } from '@/components/ui/utils'
import { useRouter } from '@/i18n/routing'
import { toast } from '@/lib/toast'
import { recordPaymentAction } from '../../../_lib/payment-actions'

interface Option {
  id: string
  name: string
}

type Method = 'CASH' | 'CARD' | 'TRANSFER' | 'CHECK'

const METHODS: Array<{ value: Method; icon: LucideIcon }> = [
  { value: 'CASH', icon: Banknote },
  { value: 'CARD', icon: CreditCard },
  { value: 'TRANSFER', icon: ArrowLeftRight },
  { value: 'CHECK', icon: FileCheck },
]

export function RecordPaymentDialog({
  families,
  defaultOpen = false,
  redirectTo = '/dashboard/payments',
  showTrigger = true,
  remainingAmount,
}: {
  families: Option[]
  defaultOpen?: boolean
  redirectTo?: string
  showTrigger?: boolean
  remainingAmount?: number
}) {
  const t = useTranslations('dashboard.pages.payments.record')

  return (
    <Dialog initialOpen={defaultOpen}>
      <DialogRouteOpener open={defaultOpen} cleanUrl={redirectTo} />
      {showTrigger && (
        <DialogTrigger>
          <Button>+ {t('title')}</Button>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          {families.length === 1 && <p className="text-sm text-gray-500">{families[0].name}</p>}
        </DialogHeader>
        <RecordPaymentForm families={families} remainingAmount={remainingAmount} />
      </DialogContent>
    </Dialog>
  )
}

function RecordPaymentForm({
  families,
  remainingAmount,
}: {
  families: Option[]
  remainingAmount?: number
}) {
  const t = useTranslations('dashboard.pages.payments.record')
  const format = useFormatter()
  const { setOpen } = useDialog()
  const [isPending, startTransition] = useTransition()
  const [method, setMethod] = useState<Method>('CASH')
  const [amount, setAmount] = useState('')
  const router = useRouter()

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = await recordPaymentAction({
        familyId: formData.get('familyId') as string,
        amount: Number(formData.get('amount')),
        method,
        reference: (formData.get('reference') as string) || undefined,
        paidAt: new Date(formData.get('paidAt') as string),
        cashedAt:
          method === 'CHECK' && formData.get('cashedAt')
            ? new Date(formData.get('cashedAt') as string)
            : undefined,
      })
      if (result !== 'OK') {
        toast.error(t.has(`errors.${result}`) ? t(`errors.${result}`) : t('error'))
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
        <div className="space-y-5">
          {families.length === 1 ? (
            <input type="hidden" name="familyId" value={families[0].id} />
          ) : (
            <div className="space-y-2">
              <Label htmlFor="payment-family">{t('selectFamily')}</Label>
              <select
                id="payment-family"
                name="familyId"
                required
                disabled={isPending}
                className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
              >
                {families.map((family) => (
                  <option key={family.id} value={family.id}>
                    {family.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="payment-amount">{t('amount')}</Label>
            <div className="relative">
              <Input
                id="payment-amount"
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                inputMode="decimal"
                placeholder="0,00"
                required
                disabled={isPending}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-12 pr-10 text-lg font-semibold tabular-nums"
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-gray-400">
                €
              </span>
            </div>
            {remainingAmount !== undefined && remainingAmount > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-gray-500">
                  {t('remainingLabel', {
                    amount: format.number(remainingAmount, {
                      style: 'currency',
                      currency: 'EUR',
                    }),
                  })}
                </span>
                <button
                  type="button"
                  onClick={() => setAmount(String(remainingAmount))}
                  disabled={isPending}
                  className="font-medium text-primary underline-offset-2 hover:underline"
                >
                  {t('payFull')}
                </button>
              </div>
            )}
          </div>

          <fieldset disabled={isPending} className="space-y-2">
            <legend className="mb-2 text-sm font-medium leading-none">{t('method')}</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {METHODS.map(({ value, icon: Icon }) => (
                <label
                  key={value}
                  className={cn(
                    'flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border p-3 text-xs font-medium transition-colors',
                    method === value
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                  )}
                >
                  <input
                    type="radio"
                    name="method"
                    value={value}
                    checked={method === value}
                    onChange={() => setMethod(value)}
                    className="sr-only"
                  />
                  <Icon className="h-5 w-5" />
                  {t(`methods.${value}`)}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="space-y-2">
            <Label htmlFor="payment-reference">
              {t('reference')}
              <span className="ml-1 font-normal text-gray-400">{t('optional')}</span>
            </Label>
            <Input
              id="payment-reference"
              name="reference"
              maxLength={250}
              disabled={isPending}
              placeholder={t(`referencePlaceholders.${method}`)}
            />
          </div>

          <div className={cn('grid grid-cols-1 gap-4', method === 'CHECK' && 'sm:grid-cols-2')}>
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
            {method === 'CHECK' && (
              <div className="space-y-2">
                <Label htmlFor="payment-cashedAt">
                  {t('cashedAt')}
                  <span className="ml-1 font-normal text-gray-400">{t('optional')}</span>
                </Label>
                <Input id="payment-cashedAt" name="cashedAt" type="date" disabled={isPending} />
                <p className="text-xs text-gray-500">{t('cashedAtHint')}</p>
              </div>
            )}
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
