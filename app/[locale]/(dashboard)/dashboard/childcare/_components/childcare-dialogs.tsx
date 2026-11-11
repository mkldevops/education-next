'use client'

import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
} from '@peaklab/ui'
import { ArrowLeft, Plus, Search } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useId, useState, useTransition } from 'react'
import { DialogFormActions, useDialogForm } from '@/features/forms'
import { toast, toastActionError } from '@/lib/toast'
import { cn } from '@/lib/utils'
import {
  attachChildcareFamilyAction,
  billChildcareMonthAction,
  cancelChildcareChargeAction,
  createChildcareFamilyAction,
  removeChildcareSubscriptionAction,
  saveChildcareSubscriptionAction,
  searchChildcareStudentsAction,
} from '../../../_lib/childcare-actions'
import { FamilyCombobox, type FamilyOption } from './family-combobox'

const MONTH_PATTERN = '\\d{4}-\\d{2}'
const PHONE_PATTERN = '\\+?[\\d\\s\\(\\)\\.\\-]{6,20}'

export type { FamilyOption }

type Subscription = {
  studentId: string
  name: string
  monthlyAmount: number
  startMonth: string
  endMonth: string | null
}

type FoundStudent = Awaited<ReturnType<typeof searchChildcareStudentsAction>>[number]

function RateField({
  id,
  rates,
  defaultValue,
  disabled,
}: {
  id: string
  rates: number[]
  defaultValue?: number
  disabled: boolean
}) {
  const t = useTranslations('dashboard.pages.childcare')
  const [value, setValue] = useState(defaultValue === undefined ? '' : String(defaultValue))
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{t('form.monthlyAmount')}</Label>
      <Input
        id={id}
        name="monthlyAmount"
        type="number"
        inputMode="decimal"
        min={0}
        step="any"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        required
        disabled={disabled}
      />
      {rates.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-graphite-600">
          {t('form.knownRates')}
          {rates.map((rate) => (
            <button
              key={rate}
              type="button"
              disabled={disabled}
              onClick={() => setValue(String(rate))}
              className={cn(
                'rounded-full border px-2 py-0.5 tabular-nums',
                value === String(rate)
                  ? 'border-primary bg-primary/15 text-graphite'
                  : 'border-alabaster-700 hover:bg-alabaster-900'
              )}
            >
              {rate.toLocaleString()}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function AddChildDialog({
  rates,
  families,
  currentMonth,
}: {
  rates: number[]
  families: FamilyOption[]
  currentMonth: string
}) {
  const t = useTranslations('dashboard.pages.childcare')
  return (
    <Dialog>
      <DialogTrigger>
        <Button variant="outline">
          <Plus className="size-4" aria-hidden="true" />
          {t('add.trigger')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('add.title')}</DialogTitle>
        </DialogHeader>
        <AddChildForm rates={rates} families={families} currentMonth={currentMonth} />
      </DialogContent>
    </Dialog>
  )
}

function AddChildForm({
  rates,
  families,
  currentMonth,
}: {
  rates: number[]
  families: FamilyOption[]
  currentMonth: string
}) {
  const t = useTranslations('dashboard.pages.childcare')
  const id = useId()
  const { isPending, close, startTransition } = useDialogForm(t)
  const [searching, startSearch] = useTransition()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<FoundStudent[] | null>(null)
  const [selected, setSelected] = useState<FoundStudent | null>(null)
  const [familyId, setFamilyId] = useState<string | null>(null)
  const [newFamily, setNewFamily] = useState<string | null>(null)

  const search = () => {
    if (query.trim().length < 2) return
    startSearch(async () => {
      setResults(await searchChildcareStudentsAction(query))
      setSelected(null)
    })
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        if (!selected) return
        const formData = new FormData(event.currentTarget)
        startTransition(async () => {
          const saved = await saveChildcareSubscriptionAction({
            studentId: selected.id,
            monthlyAmount: Number(formData.get('monthlyAmount')),
            startMonth: formData.get('startMonth') as string,
            endMonth: null,
          })
          if (saved !== 'OK') {
            toastActionError(t, saved)
            return
          }
          const linked = newFamily
            ? await createChildcareFamilyAction(selected.id, { name: newFamily })
            : familyId
              ? await attachChildcareFamilyAction(selected.id, familyId)
              : ('OK' as const)
          if (linked !== 'OK') {
            toastActionError(t, linked)
            close()
            return
          }
          toast.success(t('add.success', { name: selected.name }))
          close()
        })
      }}
    >
      <DialogBody>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`${id}-query`}>{t('add.student')}</Label>
            <div className="flex gap-2">
              <Input
                id={`${id}-query`}
                type="search"
                value={query}
                placeholder={t('add.searchPlaceholder')}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return
                  event.preventDefault()
                  search()
                }}
                disabled={isPending}
              />
              <Button
                type="button"
                variant="outline"
                onClick={search}
                disabled={isPending || searching || query.trim().length < 2}
                aria-label={t('add.searchSubmit')}
              >
                <Search className="size-4" aria-hidden="true" />
              </Button>
            </div>
            {results &&
              (results.length === 0 ? (
                <p className="text-sm text-graphite-600">{t('noResult')}</p>
              ) : (
                <ul className="max-h-56 divide-y divide-alabaster-700 overflow-y-auto rounded border border-alabaster-700">
                  {results.map((student) => (
                    <li key={student.id}>
                      <label
                        className={cn(
                          'flex items-center justify-between gap-3 px-3 py-2 text-sm',
                          student.subscribed
                            ? 'text-graphite-600'
                            : 'cursor-pointer hover:bg-alabaster-900',
                          selected?.id === student.id && 'bg-primary/15'
                        )}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <input
                            type="radio"
                            name="student"
                            value={student.id}
                            checked={selected?.id === student.id}
                            disabled={student.subscribed || isPending}
                            onChange={() => {
                              setSelected(student)
                              setFamilyId(null)
                              setNewFamily(null)
                            }}
                          />
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-graphite">
                              {student.name}
                            </span>
                            <span className="block truncate text-xs text-graphite-600">
                              {student.className ?? t('noClass')} ·{' '}
                              {student.familyName ?? t('family.none')}
                            </span>
                          </span>
                        </span>
                        {student.subscribed && (
                          <span className="shrink-0 text-xs">{t('alreadySubscribed')}</span>
                        )}
                      </label>
                    </li>
                  ))}
                </ul>
              ))}
          </div>

          {selected && selected.familyName === null && (
            <div className="space-y-2 rounded border border-amber-200 bg-amber-50 p-3">
              <Label htmlFor={`${id}-family`} className="text-sm font-normal text-amber-900">
                {t('family.missingHint')}
              </Label>
              {newFamily === null ? (
                <FamilyCombobox
                  id={`${id}-family`}
                  families={families}
                  value={familyId}
                  onValueChange={setFamilyId}
                  onCreate={setNewFamily}
                  disabled={isPending}
                />
              ) : (
                <p className="home-rise flex flex-wrap items-center justify-between gap-2 rounded border border-primary/40 bg-white px-3 py-2 text-sm">
                  <span>{t('family.willCreate', { name: newFamily })}</span>
                  <button
                    type="button"
                    onClick={() => setNewFamily(null)}
                    disabled={isPending}
                    className="text-primary hover:underline"
                  >
                    {t('family.change')}
                  </button>
                </p>
              )}
            </div>
          )}

          <RateField id={`${id}-amount`} rates={rates} disabled={isPending} />
          <div className="space-y-2">
            <Label htmlFor={`${id}-start`}>{t('form.startMonth')}</Label>
            <Input
              id={`${id}-start`}
              name="startMonth"
              type="month"
              pattern={MONTH_PATTERN}
              defaultValue={currentMonth}
              required
              disabled={isPending}
            />
            <p className="text-xs text-graphite-600">{t('add.hint')}</p>
          </div>
        </div>
      </DialogBody>
      <DialogFormActions
        t={t}
        isPending={isPending}
        submitDisabled={!selected}
        onCancel={close}
        submitKey="add.submit"
      />
    </form>
  )
}

export function EditSubscriptionDialog({
  subscription,
  rates,
}: {
  subscription: Subscription
  rates: number[]
}) {
  const t = useTranslations('dashboard.pages.childcare')
  return (
    <Dialog>
      <DialogTrigger>
        <Button variant="outline" size="sm">
          {t('form.edit')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('form.editTitle', { name: subscription.name })}</DialogTitle>
        </DialogHeader>
        <EditSubscriptionForm subscription={subscription} rates={rates} />
      </DialogContent>
    </Dialog>
  )
}

function EditSubscriptionForm({
  subscription,
  rates,
}: {
  subscription: Subscription
  rates: number[]
}) {
  const t = useTranslations('dashboard.pages.childcare')
  const id = useId()
  const { isPending, close, onSubmit } = useDialogForm(t)

  const handleSubmit = onSubmit(
    (formData) =>
      saveChildcareSubscriptionAction({
        studentId: subscription.studentId,
        monthlyAmount: Number(formData.get('monthlyAmount')),
        startMonth: formData.get('startMonth') as string,
        endMonth: subscription.endMonth,
      }),
    { successKey: 'form.success' }
  )

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody>
        <div className="space-y-4">
          <RateField
            id={`${id}-amount`}
            rates={rates}
            defaultValue={subscription.monthlyAmount}
            disabled={isPending}
          />
          <p className="text-xs text-graphite-600">{t('form.rateHint')}</p>
          <div className="space-y-2">
            <Label htmlFor={`${id}-start`}>{t('form.startMonth')}</Label>
            <Input
              id={`${id}-start`}
              name="startMonth"
              type="month"
              pattern={MONTH_PATTERN}
              defaultValue={subscription.startMonth}
              required
              disabled={isPending}
            />
          </div>
        </div>
      </DialogBody>
      <DialogFormActions t={t} isPending={isPending} onCancel={close} />
    </form>
  )
}

export function StopSubscriptionDialog({
  subscription,
  earliestEnd,
  lastBilledLabel,
  remaining,
}: {
  subscription: Subscription
  earliestEnd: string
  lastBilledLabel: string | null
  remaining: string | null
}) {
  const t = useTranslations('dashboard.pages.childcare')
  return (
    <Dialog>
      <DialogTrigger>
        <Button variant="outline" size="sm" className="text-red-700">
          {t('stop.trigger')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('stop.title', { name: subscription.name })}</DialogTitle>
        </DialogHeader>
        <StopSubscriptionForm
          subscription={subscription}
          earliestEnd={earliestEnd}
          lastBilledLabel={lastBilledLabel}
          remaining={remaining}
        />
      </DialogContent>
    </Dialog>
  )
}

function StopSubscriptionForm({
  subscription,
  earliestEnd,
  lastBilledLabel,
  remaining,
}: {
  subscription: Subscription
  earliestEnd: string
  lastBilledLabel: string | null
  remaining: string | null
}) {
  const t = useTranslations('dashboard.pages.childcare')
  const id = useId()
  const { isPending, close, onSubmit } = useDialogForm(t)

  const handleSubmit = onSubmit(
    (formData) =>
      saveChildcareSubscriptionAction({
        studentId: subscription.studentId,
        monthlyAmount: subscription.monthlyAmount,
        startMonth: subscription.startMonth,
        endMonth: formData.get('endMonth') as string,
      }),
    { successKey: 'stop.success' }
  )

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`${id}-end`}>{t('stop.lastMonth')}</Label>
            <Input
              id={`${id}-end`}
              name="endMonth"
              type="month"
              pattern={MONTH_PATTERN}
              min={earliestEnd}
              defaultValue={earliestEnd}
              required
              disabled={isPending}
            />
            <p className="text-xs text-graphite-600">
              {lastBilledLabel
                ? t('stop.lastBilled', { month: lastBilledLabel })
                : t('stop.noBill')}
            </p>
          </div>
          {remaining && (
            <p className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              {t('stop.stillDue', { amount: remaining })}
            </p>
          )}
          <p className="text-xs text-graphite-600">{t('stop.resumeHint')}</p>
        </div>
      </DialogBody>
      <DialogFormActions
        t={t}
        isPending={isPending}
        onCancel={close}
        submitKey="stop.submit"
        submitVariant="destructive"
      />
    </form>
  )
}

export function ResumeSubscriptionDialog({ subscription }: { subscription: Subscription }) {
  const t = useTranslations('dashboard.pages.childcare')
  return (
    <Dialog>
      <DialogTrigger>
        <Button variant="outline" size="sm">
          {t('resume.trigger')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('resume.title', { name: subscription.name })}</DialogTitle>
        </DialogHeader>
        <ResumeSubscriptionForm subscription={subscription} />
      </DialogContent>
    </Dialog>
  )
}

function ResumeSubscriptionForm({ subscription }: { subscription: Subscription }) {
  const t = useTranslations('dashboard.pages.childcare')
  const { isPending, close, onSubmit } = useDialogForm(t)
  return (
    <form
      onSubmit={onSubmit(
        () =>
          saveChildcareSubscriptionAction({
            studentId: subscription.studentId,
            monthlyAmount: subscription.monthlyAmount,
            startMonth: subscription.startMonth,
            endMonth: null,
          }),
        { successKey: 'resume.success' }
      )}
    >
      <DialogBody>
        <p className="text-sm text-graphite-600">{t('resume.description')}</p>
      </DialogBody>
      <DialogFormActions t={t} isPending={isPending} onCancel={close} submitKey="resume.submit" />
    </form>
  )
}

export function AttachFamilyDialog({
  studentId,
  name,
  families,
}: {
  studentId: string
  name: string
  families: FamilyOption[]
}) {
  const t = useTranslations('dashboard.pages.childcare')
  return (
    <Dialog>
      <DialogTrigger>
        <Button variant="outline" size="sm">
          {t('family.attach')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('family.attachTitle', { name })}</DialogTitle>
        </DialogHeader>
        <AttachFamilyForm
          studentId={studentId}
          suggestedName={name.split(' ').at(-1) ?? ''}
          families={families}
        />
      </DialogContent>
    </Dialog>
  )
}

function AttachFamilyForm({
  studentId,
  suggestedName,
  families,
}: {
  studentId: string
  suggestedName: string
  families: FamilyOption[]
}) {
  const t = useTranslations('dashboard.pages.childcare')
  const id = useId()
  const [familyId, setFamilyId] = useState<string | null>(null)
  const [newName, setNewName] = useState<string | null>(null)
  const { isPending, close, onSubmit } = useDialogForm(t)

  if (newName !== null) {
    return (
      <form
        onSubmit={onSubmit(
          (formData) =>
            createChildcareFamilyAction(studentId, {
              name: formData.get('name') as string,
              emergencyContactName: (formData.get('contactName') as string) || undefined,
              emergencyContactPhone: (formData.get('contactPhone') as string) || undefined,
            }),
          { successKey: 'family.created' }
        )}
      >
        <DialogBody>
          <div className="home-rise space-y-4">
            <button
              type="button"
              onClick={() => setNewName(null)}
              disabled={isPending}
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              {t('family.backToList')}
            </button>
            <div className="space-y-2">
              <Label htmlFor={`${id}-name`}>{t('family.newName')}</Label>
              <Input
                id={`${id}-name`}
                name="name"
                defaultValue={newName}
                autoComplete="off"
                maxLength={50}
                required
                autoFocus
                disabled={isPending}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`${id}-contact`}>{t('family.contactName')}</Label>
                <Input
                  id={`${id}-contact`}
                  name="contactName"
                  autoComplete="off"
                  maxLength={250}
                  disabled={isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${id}-phone`}>{t('family.contactPhone')}</Label>
                <Input
                  id={`${id}-phone`}
                  name="contactPhone"
                  autoComplete="off"
                  type="tel"
                  maxLength={20}
                  pattern={PHONE_PATTERN}
                  disabled={isPending}
                />
              </div>
            </div>
            <p className="text-xs text-graphite-600">{t('family.createHint')}</p>
          </div>
        </DialogBody>
        <DialogFormActions
          t={t}
          isPending={isPending}
          onCancel={close}
          submitKey="family.createSubmit"
        />
      </form>
    )
  }

  return (
    <form
      onSubmit={onSubmit(() => attachChildcareFamilyAction(studentId, familyId ?? ''), {
        successKey: 'family.success',
      })}
    >
      <DialogBody>
        <div className="space-y-4">
          <p className="text-sm text-graphite-600">{t('family.attachDescription')}</p>
          <div className="space-y-2">
            <Label htmlFor={`${id}-family`}>{t('family.label')}</Label>
            <FamilyCombobox
              id={`${id}-family`}
              families={families}
              value={familyId}
              onValueChange={setFamilyId}
              onCreate={setNewName}
              disabled={isPending}
            />
            <button
              type="button"
              onClick={() => setNewName(suggestedName)}
              disabled={isPending}
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <Plus className="size-4" aria-hidden="true" />
              {t('family.create')}
            </button>
          </div>
        </div>
      </DialogBody>
      <DialogFormActions
        t={t}
        isPending={isPending}
        onCancel={close}
        submitKey="family.submit"
        submitDisabled={!familyId}
      />
    </form>
  )
}

export function BillMonthDialog({
  currentMonth,
  currentMonthLabel,
}: {
  currentMonth: string
  currentMonthLabel: string
}) {
  const t = useTranslations('dashboard.pages.childcare')
  return (
    <Dialog>
      <DialogTrigger>
        <Button>{t('bill.trigger', { month: currentMonthLabel })}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('bill.title')}</DialogTitle>
        </DialogHeader>
        <BillMonthForm currentMonth={currentMonth} />
      </DialogContent>
    </Dialog>
  )
}

function BillMonthForm({ currentMonth }: { currentMonth: string }) {
  const t = useTranslations('dashboard.pages.childcare')
  const { isPending, close, startTransition } = useDialogForm(t)

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        const month = new FormData(event.currentTarget).get('month') as string
        startTransition(async () => {
          const result = await billChildcareMonthAction(month)
          if (typeof result === 'string') {
            toastActionError(t, result)
            return
          }
          toast.success(t('bill.result', result))
          close()
        })
      }}
    >
      <DialogBody>
        <div className="space-y-2">
          <p className="text-sm text-graphite-600">{t('bill.description')}</p>
          <Label htmlFor="childcare-bill-month">{t('bill.month')}</Label>
          <Input
            id="childcare-bill-month"
            name="month"
            type="month"
            pattern={MONTH_PATTERN}
            max={currentMonth}
            defaultValue={currentMonth}
            required
            disabled={isPending}
          />
        </div>
      </DialogBody>
      <DialogFormActions t={t} isPending={isPending} onCancel={close} submitKey="bill.submit" />
    </form>
  )
}

export function CancelChargeDialog({ chargeId, month }: { chargeId: string; month: string }) {
  const t = useTranslations('dashboard.pages.childcare')
  return (
    <Dialog>
      <DialogTrigger>
        <Button
          variant="ghost"
          size="sm"
          aria-label={t('cancelCharge.label', { month })}
          className="text-graphite-600"
        >
          {t('cancelCharge.trigger')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('cancelCharge.title', { month })}</DialogTitle>
        </DialogHeader>
        <CancelChargeForm chargeId={chargeId} />
      </DialogContent>
    </Dialog>
  )
}

function CancelChargeForm({ chargeId }: { chargeId: string }) {
  const t = useTranslations('dashboard.pages.childcare')
  const { isPending, close, onSubmit } = useDialogForm(t)

  const handleSubmit = onSubmit(
    (formData) => cancelChildcareChargeAction(chargeId, formData.get('reason') as string),
    { successKey: 'cancelCharge.success' }
  )

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody>
        <div className="space-y-2">
          <p className="text-sm text-graphite-600">{t('cancelCharge.description')}</p>
          <Label htmlFor={`childcare-cancel-${chargeId}`}>{t('cancelCharge.reason')}</Label>
          <Input
            id={`childcare-cancel-${chargeId}`}
            name="reason"
            maxLength={250}
            required
            disabled={isPending}
          />
        </div>
      </DialogBody>
      <DialogFormActions
        t={t}
        isPending={isPending}
        onCancel={close}
        submitKey="cancelCharge.submit"
        submitVariant="destructive"
      />
    </form>
  )
}

export function RemoveSubscriptionDialog({ studentId }: { studentId: string }) {
  const t = useTranslations('dashboard.pages.childcare')
  return (
    <Dialog>
      <DialogTrigger>
        <Button variant="ghost" size="sm" className="text-graphite-600">
          {t('remove.trigger')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('remove.title')}</DialogTitle>
        </DialogHeader>
        <RemoveSubscriptionForm studentId={studentId} />
      </DialogContent>
    </Dialog>
  )
}

function RemoveSubscriptionForm({ studentId }: { studentId: string }) {
  const t = useTranslations('dashboard.pages.childcare')
  const { isPending, close, onSubmit } = useDialogForm(t)

  return (
    <form
      onSubmit={onSubmit(() => removeChildcareSubscriptionAction(studentId), {
        successKey: 'remove.success',
      })}
    >
      <DialogBody>
        <p className="text-sm text-graphite-600">{t('remove.description')}</p>
      </DialogBody>
      <DialogFormActions
        t={t}
        isPending={isPending}
        onCancel={close}
        submitKey="remove.submit"
        submitVariant="destructive"
      />
    </form>
  )
}
