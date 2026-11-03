'use client'

import {
  Button,
  cn,
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogRouteOpener,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@peaklab/ui'
import type { LucideIcon } from 'lucide-react'
import { ArrowLeftRight, Banknote, CreditCard, FileCheck, Plus } from 'lucide-react'
import { useFormatter, useLocale, useTranslations } from 'next-intl'
import { type ReactNode, useState } from 'react'
import { DialogFormActions, useDialogForm } from '@/features/forms'
import { Link, useRouter } from '@/i18n/routing'
import { currencyFractionDigits, currencyStep, currencySymbol } from '@/lib/decimal'
import type { PayableEnrollmentChoice } from '@/use-cases/payments/payable-enrollment-choices'
import type { ManualPaymentMethod } from '@/use-cases/payments/schemas'
import { recordPaymentAction } from '../../../_lib/payment-actions'
import { SPREAD_TARGET, TuitionTargetField, targetEnrollmentId } from './tuition-target-field'

interface Option {
  id: string
  name: string
}

const METHODS: Array<{ value: ManualPaymentMethod; icon: LucideIcon }> = [
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
  currency,
  trigger,
  canOpenCashier = false,
  enrollments = [],
}: {
  families: Option[]
  currency: string
  /** Inscriptions à régler de l'unique famille, pour porter le règlement sur un seul enfant. */
  enrollments?: PayableEnrollmentChoice[]
  canOpenCashier?: boolean
  defaultOpen?: boolean
  redirectTo?: string
  showTrigger?: boolean
  remainingAmount?: number
  /** Bouton d'ouverture à la place du bouton principal, pour un point d'entrée secondaire. */
  trigger?: ReactNode
}) {
  const t = useTranslations('dashboard.pages.payments.record')

  return (
    <Dialog initialOpen={defaultOpen}>
      <DialogRouteOpener open={defaultOpen} cleanUrl={redirectTo} />
      {showTrigger && (
        <DialogTrigger>
          {trigger ?? (
            <Button>
              <Plus className="h-4 w-4" />
              {t('title')}
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          {families.length === 1 && <p className="text-sm text-graphite-600">{families[0].name}</p>}
        </DialogHeader>
        <RecordPaymentForm
          families={families}
          remainingAmount={remainingAmount}
          currency={currency}
          canOpenCashier={canOpenCashier}
          enrollments={families.length === 1 ? enrollments : []}
        />
      </DialogContent>
    </Dialog>
  )
}

function RecordPaymentForm({
  families,
  remainingAmount,
  currency,
  canOpenCashier,
  enrollments,
}: {
  families: Option[]
  currency: string
  remainingAmount?: number
  canOpenCashier: boolean
  enrollments: PayableEnrollmentChoice[]
}) {
  const t = useTranslations('dashboard.pages.payments.record')
  const locale = useLocale()
  const format = useFormatter()
  const smallestUnit = currencyStep(currency)
  const { isPending, close, onSubmit } = useDialogForm(t)
  const [method, setMethod] = useState<ManualPaymentMethod>('CASH')
  const [amount, setAmount] = useState('')
  const [target, setTarget] = useState(SPREAD_TARGET)
  const targeted = enrollments.find((enrollment) => enrollment.enrollmentId === target)
  const payableAmount = targeted ? targeted.remainingBalance : remainingAmount
  const familyItems = families.map((family) => ({ value: family.id, label: family.name }))
  const router = useRouter()

  const handleSubmit = onSubmit(
    (formData) =>
      recordPaymentAction({
        familyId: formData.get('familyId') as string,
        enrollmentId: targetEnrollmentId(target),
        amount: Number(formData.get('amount')),
        method,
        reference: (formData.get('reference') as string) || undefined,
        paidAt: new Date(formData.get('paidAt') as string),
        cashedAt:
          method === 'CHECK' && formData.get('cashedAt')
            ? new Date(formData.get('cashedAt') as string)
            : undefined,
      }),
    { onSuccess: () => router.refresh() }
  )

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody>
        <div className="space-y-5">
          <div className="space-y-1 rounded border border-alabaster-700 p-3 text-sm">
            <p className="text-graphite-600">{t('scopeHint')}</p>
            {canOpenCashier && families.length === 1 && (
              <p>
                <span className="text-graphite-600">{t('servicesPrompt')}</span>{' '}
                <Link
                  href={`/dashboard/cashier?familyId=${families[0].id}`}
                  className="font-medium text-foreground underline"
                >
                  {t('servicesLink')}
                </Link>
              </p>
            )}
          </div>

          {families.length === 1 ? (
            <input type="hidden" name="familyId" value={families[0].id} />
          ) : (
            <div className="space-y-2">
              <Label htmlFor="payment-family">{t('selectFamily')}</Label>
              <Select
                name="familyId"
                items={familyItems}
                required
                disabled={isPending}
                defaultValue={familyItems[0]?.value}
              >
                <SelectTrigger id="payment-family">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {familyItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <TuitionTargetField
            id="payment-target"
            enrollments={enrollments}
            value={target}
            onChange={setTarget}
            currency={currency}
            disabled={isPending}
          />

          <div className="space-y-2">
            <Label htmlFor="payment-amount">{t('amount')}</Label>
            <div className="relative">
              <Input
                id="payment-amount"
                name="amount"
                type="number"
                step={smallestUnit}
                min={smallestUnit}
                inputMode={smallestUnit < 1 ? 'decimal' : 'numeric'}
                placeholder={format.number(0, {
                  minimumFractionDigits: currencyFractionDigits(currency),
                })}
                required
                disabled={isPending}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-12 pr-10 text-lg font-semibold tabular-nums"
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-graphite-700">
                {currencySymbol(locale, currency)}
              </span>
            </div>
            {payableAmount !== undefined && payableAmount > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-graphite-600">
                  {t('remainingLabel', {
                    amount: format.number(payableAmount, {
                      style: 'currency',
                      currency,
                    }),
                  })}
                </span>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  onClick={() => setAmount(String(payableAmount))}
                  disabled={isPending}
                  className="h-auto px-0"
                >
                  {t('payFull')}
                </Button>
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
                    'flex cursor-pointer flex-col items-center gap-1.5 rounded border p-3 text-xs font-medium transition-colors',
                    method === value
                      ? 'border-primary bg-primary/5 text-foreground'
                      : 'border-alabaster-700 text-graphite-600 hover:border-alabaster hover:bg-alabaster-900'
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
              <span className="ml-1 font-normal text-graphite-700">{t('optional')}</span>
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
                  <span className="ml-1 font-normal text-graphite-700">{t('optional')}</span>
                </Label>
                <Input id="payment-cashedAt" name="cashedAt" type="date" disabled={isPending} />
                <p className="text-xs text-graphite-600">{t('cashedAtHint')}</p>
              </div>
            )}
          </div>
        </div>
      </DialogBody>
      <DialogFormActions t={t} isPending={isPending} onCancel={close} />
    </form>
  )
}
