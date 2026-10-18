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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  useDialog,
} from '@peaklab/ui'
import { Plus, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { type FormEvent, useEffect, useId, useState } from 'react'
import { parseLanguagesAtHome } from '@/domain/family'
import { RequiredMark, useDialogForm } from '@/features/forms'
import { useRouter } from '@/i18n/routing'
import { toast } from '@/lib/toast'
import { createFullFamilySchema } from '@/use-cases/families/create-full-family-schema'
import { ClassSelect } from '../../../_components/class-select'
import type { ClassOption } from '../../../_lib/class-options'
import { createFamilyAction } from '../../../_lib/family-actions'

interface PlanOption {
  id: string
  name: string
  amount?: number
}

interface CreateFamilyDialogProps {
  defaultOpen?: boolean
  /** Plans et classes de la période sélectionnée : vides, l'inscription n'est pas proposée. */
  plans?: PlanOption[]
  classes?: ClassOption[]
  /** Faux, l'inscription se fait sans formule. */
  paymentsEnabled?: boolean
}

type Sex = 'MALE' | 'FEMALE'

interface ChildDraft {
  key: string
  name: string
  lastname: string
  sex: Sex | null
  birthday: string
  enroll: boolean
  planId: string
  /** `null` tant que la classe n'est pas choisie : aucune présélection (#482). */
  classPeriodId: string | null
}

const STEPS = ['guardian', 'children', 'summary'] as const

export function CreateFamilyDialog({
  defaultOpen = false,
  plans = [],
  classes = [],
  paymentsEnabled = true,
}: CreateFamilyDialogProps) {
  const t = useTranslations('dashboard.pages.families.create')

  return (
    <Dialog initialOpen={defaultOpen}>
      <DialogTrigger>
        <Button>
          <Plus className="h-4 w-4" />
          {t('title')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>
        <CreateFamilyWizard
          defaultOpen={defaultOpen}
          plans={plans}
          classes={classes}
          paymentsEnabled={paymentsEnabled}
        />
      </DialogContent>
    </Dialog>
  )
}

function CreateFamilyWizard({
  defaultOpen,
  plans,
  classes,
  paymentsEnabled,
}: Required<CreateFamilyDialogProps>) {
  const t = useTranslations('dashboard.pages.families.create')
  const { setOpen } = useDialog()
  const { isPending, close, run } = useDialogForm(t)
  const router = useRouter()
  const idPrefix = useId()

  useEffect(() => {
    if (defaultOpen) {
      setOpen(true)
      router.replace('/dashboard/families')
    }
  }, [defaultOpen, setOpen, router])

  // Sans formule à choisir, l'inscription reste possible hors drapeau : seule la classe compte.
  const canEnroll = classes.length > 0 && (!paymentsEnabled || plans.length > 0)

  const [step, setStep] = useState(0)
  const [guardian, setGuardian] = useState({ name: '', lastname: '', phoneNumber: '', email: '' })
  // `null` : la valeur suit le responsable ; une saisie la détache.
  const [familyName, setFamilyName] = useState<string | null>(null)
  const [emergencyName, setEmergencyName] = useState<string | null>(null)
  const [emergencyPhone, setEmergencyPhone] = useState<string | null>(null)
  const [authorizedPickup, setAuthorizedPickup] = useState('')
  const [languagesAtHome, setLanguagesAtHome] = useState('')
  const [children, setChildren] = useState<ChildDraft[]>([])

  const hasGuardian = Object.values(guardian).some((value) => value.trim() !== '')
  const guardianFullName = `${guardian.name} ${guardian.lastname}`.trim()
  const familyNameValue = familyName ?? guardian.lastname
  const emergencyNameValue = emergencyName ?? guardianFullName
  const emergencyPhoneValue = emergencyPhone ?? guardian.phoneNumber

  const addChild = () =>
    setChildren((current) => [
      ...current,
      {
        key: crypto.randomUUID(),
        name: '',
        lastname: guardian.lastname || familyNameValue,
        sex: null,
        birthday: '',
        enroll: canEnroll,
        planId: plans[0]?.id ?? '',
        classPeriodId: null,
      },
    ])

  const updateChild = (key: string, patch: Partial<ChildDraft>) =>
    setChildren((current) => current.map((c) => (c.key === key ? { ...c, ...patch } : c)))

  const removeChild = (key: string) =>
    setChildren((current) => current.filter((c) => c.key !== key))

  const buildPayload = () => {
    const optional = (value: string) => (value.trim() === '' ? undefined : value.trim())
    return {
      name: familyNameValue,
      emergencyContactName: optional(emergencyNameValue),
      emergencyContactPhone: optional(emergencyPhoneValue),
      authorizedPickup: optional(authorizedPickup),
      languagesAtHome: parseLanguagesAtHome(languagesAtHome),
      parents: hasGuardian
        ? [
            {
              name: guardian.name,
              lastname: guardian.lastname,
              phoneNumber: optional(guardian.phoneNumber),
              email: optional(guardian.email),
            },
          ]
        : [],
      students: children.map((child) => ({
        person: {
          name: child.name,
          lastname: child.lastname,
          sex: child.sex ?? undefined,
        },
        student: { birthday: child.birthday ? new Date(child.birthday) : undefined },
        ...(child.enroll && canEnroll
          ? {
              enrollment: {
                // Hors drapeau la formule n'existe pas : le use case résout la formule réservée.
                ...(paymentsEnabled ? { planId: child.planId } : {}),
                classPeriodId: child.classPeriodId,
              },
            }
          : {}),
      })),
    }
  }

  // Un enfant inscrit exige une classe choisie explicitement.
  const missingClass = canEnroll && children.some((c) => c.enroll && c.classPeriodId === null)

  const goNext = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (step === 1 && missingClass) {
      toast.error(t('classRequired'))
      return
    }
    if (step === 0) {
      const parsed = createFullFamilySchema
        .pick({ name: true, emergencyContactPhone: true, parents: true })
        .safeParse(buildPayload())
      if (!parsed.success) {
        const field = parsed.error.issues[0]?.path[0]
        toast.error(
          field === 'emergencyContactPhone'
            ? t('emergencyContactPhoneInvalid')
            : field === 'parents'
              ? t('guardianInvalid')
              : t('errors.validationError')
        )
        return
      }
    }
    setStep((current) => Math.min(current + 1, STEPS.length - 1))
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (missingClass) {
      toast.error(t('classRequired'))
      return
    }
    const parsed = createFullFamilySchema.omit({ schoolId: true }).safeParse(buildPayload())
    if (!parsed.success) {
      toast.error(t('errors.validationError'))
      return
    }
    run(() => createFamilyAction(parsed.data), {
      successKey: children.length > 0 ? 'successWithChildren' : 'success',
      onSuccess: (family) => router.push(`/dashboard/families/${family.id}`),
    })
  }

  const planName = (id: string) => plans.find((p) => p.id === id)?.name ?? ''
  const className = (id: string | null) => classes.find((c) => c.id === id)?.name ?? ''
  const planItems = plans.map((p) => ({ value: p.id, label: p.name }))
  const sexItems = [
    { value: null, label: t('unspecified') },
    { value: 'MALE', label: t('male') },
    { value: 'FEMALE', label: t('female') },
  ]
  const isLast = step === STEPS.length - 1

  return (
    <form onSubmit={isLast ? submit : goNext}>
      <DialogBody>
        <ol className="mb-4 flex gap-2 text-xs">
          {STEPS.map((key, index) => (
            <li
              key={key}
              aria-current={index === step ? 'step' : undefined}
              className={
                index === step
                  ? 'rounded-full bg-teal-600 px-3 py-1 font-medium text-white'
                  : 'rounded-full bg-graphite-100 px-3 py-1 text-graphite-600'
              }
            >
              {index + 1}. {t(`steps.${key}`)}
            </li>
          ))}
        </ol>

        {step === 0 && (
          <div className="space-y-4">
            <p className="font-medium text-sm">{t('guardianTitle')}</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`${idPrefix}-guardian-name`}>{t('firstname')}</Label>
                <Input
                  id={`${idPrefix}-guardian-name`}
                  value={guardian.name}
                  onChange={(e) => setGuardian({ ...guardian, name: e.target.value })}
                  required={hasGuardian}
                  maxLength={250}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${idPrefix}-guardian-lastname`}>{t('lastname')}</Label>
                <Input
                  id={`${idPrefix}-guardian-lastname`}
                  value={guardian.lastname}
                  onChange={(e) => setGuardian({ ...guardian, lastname: e.target.value })}
                  required={hasGuardian}
                  maxLength={250}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${idPrefix}-guardian-phone`}>{t('phone')}</Label>
                <Input
                  id={`${idPrefix}-guardian-phone`}
                  type="tel"
                  value={guardian.phoneNumber}
                  onChange={(e) => setGuardian({ ...guardian, phoneNumber: e.target.value })}
                  maxLength={20}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${idPrefix}-guardian-email`}>{t('email')}</Label>
                <Input
                  id={`${idPrefix}-guardian-email`}
                  type="email"
                  value={guardian.email}
                  onChange={(e) => setGuardian({ ...guardian, email: e.target.value })}
                  maxLength={250}
                />
              </div>
            </div>
            <p className="text-graphite-500 text-xs">{t('guardianOptionalHint')}</p>

            <div className="space-y-2 border-graphite-200 border-t pt-4">
              <Label htmlFor={`${idPrefix}-name`}>
                {t('name')}
                <RequiredMark />
              </Label>
              <Input
                id={`${idPrefix}-name`}
                value={familyNameValue}
                onChange={(e) => setFamilyName(e.target.value)}
                placeholder={t('namePlaceholder')}
                required
                maxLength={50}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`${idPrefix}-emergency-name`}>{t('emergencyContactName')}</Label>
                <Input
                  id={`${idPrefix}-emergency-name`}
                  value={emergencyNameValue}
                  onChange={(e) => setEmergencyName(e.target.value)}
                  placeholder={t('emergencyContactNamePlaceholder')}
                  maxLength={250}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${idPrefix}-emergency-phone`}>{t('emergencyContactPhone')}</Label>
                <Input
                  id={`${idPrefix}-emergency-phone`}
                  type="tel"
                  value={emergencyPhoneValue}
                  onChange={(e) => setEmergencyPhone(e.target.value)}
                  placeholder={t('emergencyContactPhonePlaceholder')}
                  maxLength={20}
                />
              </div>
            </div>

            <details className="rounded border border-graphite-200 p-3">
              <summary className="cursor-pointer font-medium text-sm">
                {t('secondaryTitle')}
              </summary>
              <div className="mt-3 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor={`${idPrefix}-pickup`}>{t('authorizedPickup')}</Label>
                  <Textarea
                    id={`${idPrefix}-pickup`}
                    value={authorizedPickup}
                    onChange={(e) => setAuthorizedPickup(e.target.value)}
                    placeholder={t('authorizedPickupPlaceholder')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${idPrefix}-languages`}>{t('languagesAtHome')}</Label>
                  <Input
                    id={`${idPrefix}-languages`}
                    value={languagesAtHome}
                    onChange={(e) => setLanguagesAtHome(e.target.value)}
                    placeholder={t('languagesAtHomePlaceholder')}
                  />
                </div>
              </div>
            </details>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            {children.length === 0 && (
              <p className="text-graphite-500 text-sm">{t('noChildren')}</p>
            )}
            {!canEnroll && children.length > 0 && (
              <p className="text-amber-700 text-xs">{t('enrollUnavailable')}</p>
            )}
            {children.map((child, index) => {
              const prefix = `${idPrefix}-child-${child.key}`
              return (
                <fieldset key={child.key} className="space-y-3 rounded border p-3">
                  <div className="flex items-center justify-between">
                    <legend className="font-medium text-sm">
                      {t('childTitle', { index: index + 1 })}
                    </legend>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeChild(child.key)}
                      aria-label={t('removeChild', { index: index + 1 })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor={`${prefix}-name`}>{t('firstname')}</Label>
                      <Input
                        id={`${prefix}-name`}
                        value={child.name}
                        onChange={(e) => updateChild(child.key, { name: e.target.value })}
                        required
                        maxLength={250}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`${prefix}-lastname`}>{t('lastname')}</Label>
                      <Input
                        id={`${prefix}-lastname`}
                        value={child.lastname}
                        onChange={(e) => updateChild(child.key, { lastname: e.target.value })}
                        required
                        maxLength={250}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`${prefix}-sex`}>{t('sex')}</Label>
                      <Select
                        items={sexItems}
                        value={child.sex}
                        onValueChange={(value) =>
                          updateChild(child.key, { sex: (value as Sex | null) ?? null })
                        }
                      >
                        <SelectTrigger id={`${prefix}-sex`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {sexItems.map((item) => (
                            <SelectItem key={item.value ?? ''} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`${prefix}-birthday`}>{t('birthday')}</Label>
                      <Input
                        id={`${prefix}-birthday`}
                        type="date"
                        value={child.birthday}
                        onChange={(e) => updateChild(child.key, { birthday: e.target.value })}
                      />
                    </div>
                  </div>
                  {canEnroll && (
                    <div className="space-y-3 border-graphite-200 border-t pt-3">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="rounded"
                          checked={child.enroll}
                          onChange={(e) => updateChild(child.key, { enroll: e.target.checked })}
                        />
                        {t('enrollNow')}
                      </label>
                      {child.enroll && (
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          {paymentsEnabled && (
                            <div className="space-y-2">
                              <Label htmlFor={`${prefix}-plan`}>{t('selectPlan')}</Label>
                              <Select
                                items={planItems}
                                value={child.planId}
                                onValueChange={(value) =>
                                  updateChild(child.key, { planId: value ?? '' })
                                }
                              >
                                <SelectTrigger id={`${prefix}-plan`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {planItems.map((item) => (
                                    <SelectItem key={item.value} value={item.value}>
                                      {item.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                          <div className="space-y-2">
                            <Label htmlFor={`${prefix}-class`}>
                              {t('selectClass')}
                              <RequiredMark />
                            </Label>
                            <ClassSelect
                              id={`${prefix}-class`}
                              classes={classes}
                              value={child.classPeriodId}
                              onValueChange={(value) =>
                                updateChild(child.key, { classPeriodId: value })
                              }
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </fieldset>
              )
            })}
            <Button type="button" variant="outline" size="sm" onClick={addChild}>
              <Plus className="h-4 w-4" />
              {t('addChild')}
            </Button>
          </div>
        )}

        {step === 2 && (
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-graphite-500">{t('name')}</dt>
              <dd className="font-medium">{familyNameValue}</dd>
            </div>
            <div>
              <dt className="text-graphite-500">{t('guardianTitle')}</dt>
              <dd>
                {hasGuardian
                  ? [guardianFullName, guardian.phoneNumber, guardian.email]
                      .filter(Boolean)
                      .join(' · ')
                  : t('none')}
              </dd>
            </div>
            <div>
              <dt className="text-graphite-500">{t('emergencyContactName')}</dt>
              <dd>
                {[emergencyNameValue, emergencyPhoneValue].filter(Boolean).join(' · ') || t('none')}
              </dd>
            </div>
            <div>
              <dt className="text-graphite-500">{t('childrenTitle')}</dt>
              <dd>
                {children.length === 0 ? (
                  t('none')
                ) : (
                  <ul className="list-disc pl-5">
                    {children.map((child) => (
                      <li key={child.key}>
                        {`${child.name} ${child.lastname}`.trim()}
                        {child.enroll && canEnroll
                          ? ` — ${[paymentsEnabled ? planName(child.planId) : '', className(child.classPeriodId)].filter(Boolean).join(', ')}`
                          : ` — ${t('notEnrolled')}`}
                      </li>
                    ))}
                  </ul>
                )}
              </dd>
            </div>
          </dl>
        )}
      </DialogBody>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={close} disabled={isPending}>
          {t('cancel')}
        </Button>
        {step > 0 && (
          <Button
            type="button"
            variant="outline"
            onClick={() => setStep(step - 1)}
            disabled={isPending}
          >
            {t('back')}
          </Button>
        )}
        <Button type="submit" disabled={isPending}>
          {isPending ? '...' : t(isLast ? 'submit' : 'next')}
        </Button>
      </DialogFooter>
    </form>
  )
}
