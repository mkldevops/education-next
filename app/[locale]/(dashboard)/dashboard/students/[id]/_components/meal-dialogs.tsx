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
import { useTranslations } from 'next-intl'
import type { MealOwner } from '@/domain/meal-owner'
import { DialogFormActions, useDialogForm } from '@/features/forms'
import type { MealService } from '@/generated/prisma/enums'
import {
  changeMealScheduleAction,
  recordMealOpeningAction,
  stopMealAction,
  subscribeMealAction,
} from '../../../../_lib/meal-actions'

export type MealDialogKind = 'subscribe' | 'change' | 'stop' | 'opening'

type Props = {
  kind: MealDialogKind
  owner: MealOwner
  service: MealService
  /** Jours proposés par l'école pour ce service. */
  allowedWeekdays: number[]
  /** Jours du segment en cours, cochés par défaut. */
  weekdays: number[]
  /** Aujourd'hui dans le fuseau de l'école, `YYYY-MM-DD`. */
  today: string
  /** Période sélectionnée, pour une inscription. */
  period: { id: string; start: string; end: string } | null
  /** Dans un menu d'actions : bouton discret, rôle `menuitem` et focus rendu au déclencheur. */
  triggerRole?: React.AriaRole
  restoreFocusRef?: React.RefObject<HTMLElement | null>
  triggerVariant?: 'default' | 'outline' | 'ghost'
}

const TRIGGER_VARIANT = {
  subscribe: 'default',
  change: 'outline',
  stop: 'outline',
  opening: 'ghost',
} as const

export function MealDialog({ triggerRole, restoreFocusRef, triggerVariant, ...props }: Props) {
  const t = useTranslations('dashboard.pages.studentDetails.meals.dialog')

  return (
    <Dialog restoreFocusRef={restoreFocusRef}>
      <DialogTrigger>
        <Button
          variant={triggerVariant ?? TRIGGER_VARIANT[props.kind]}
          size="sm"
          role={triggerRole}
        >
          {t(`${props.kind}.trigger`)}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t(`${props.kind}.title`)}</DialogTitle>
        </DialogHeader>
        <MealForm {...props} />
      </DialogContent>
    </Dialog>
  )
}

function MealForm({ kind, owner, service, allowedWeekdays, weekdays, today, period }: Props) {
  const t = useTranslations('dashboard.pages.studentDetails.meals.dialog')
  const tWeekdays = useTranslations('dashboard.pages.meals.weekdays')
  const { isPending, close, onSubmit } = useDialogForm(t)
  const id = (field: string) => `meal-${kind}-${service}-${field}`
  const target = { ...owner, service }

  const handleSubmit = onSubmit(
    (formData) => {
      const date = formData.get('date') as string
      const days = formData.getAll('weekday').map(Number)
      switch (kind) {
        case 'subscribe':
          return subscribeMealAction({
            ...target,
            periodId: period?.id ?? '',
            weekdays: days,
            startOn: date,
          })
        case 'change':
          return changeMealScheduleAction({ ...target, weekdays: days, effectiveFrom: date })
        case 'stop':
          return stopMealAction({ ...target, effectiveFrom: date })
        case 'opening':
          return recordMealOpeningAction({
            ...target,
            paidThrough: date,
            reason: formData.get('reason') as string,
          })
      }
    },
    { successKey: `${kind}.success` }
  )

  const hasWeekdays = kind === 'subscribe' || kind === 'change'
  // Une inscription peut partir du début de la période ; un changement ou un arrêt, d'aujourd'hui.
  const min = kind === 'subscribe' ? period?.start : kind === 'opening' ? undefined : today
  const max = kind === 'subscribe' ? period?.end : undefined

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody>
        <div className="space-y-4">
          {hasWeekdays && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-graphite">{t('weekdays')}</legend>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {allowedWeekdays.map((day) => (
                  <label key={day} className="flex items-center gap-2 text-sm text-graphite">
                    <input
                      type="checkbox"
                      name="weekday"
                      value={day}
                      defaultChecked={weekdays.includes(day)}
                      className="rounded"
                      disabled={isPending}
                    />
                    {tWeekdays(String(day))}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <div className="space-y-2">
            <Label htmlFor={id('date')}>{t(`${kind}.date`)}</Label>
            <Input
              id={id('date')}
              name="date"
              type="date"
              defaultValue={
                kind === 'subscribe' && period && period.start > today ? period.start : today
              }
              min={min}
              max={max}
              required
              disabled={isPending}
            />
            <p className="text-xs text-graphite-600">{t(`${kind}.hint`)}</p>
          </div>
          {kind === 'opening' && (
            <div className="space-y-2">
              <Label htmlFor={id('reason')}>{t('opening.reason')}</Label>
              <Input
                id={id('reason')}
                name="reason"
                maxLength={250}
                required
                disabled={isPending}
              />
            </div>
          )}
        </div>
      </DialogBody>
      <DialogFormActions
        t={t}
        isPending={isPending}
        onCancel={close}
        submitVariant={kind === 'stop' ? 'destructive' : undefined}
      />
    </form>
  )
}
