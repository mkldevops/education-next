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
import { CalendarPlus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { DialogFormActions, useDialogForm } from '@/features/forms'
import { createClassPeriodAction } from '../../../_lib/class-period-actions'

interface GenerateClassFormProps {
  levelId: string
  levelName: string
  periodId: string
  periodName: string
  defaultCapacity: number
}

interface GenerateClassDialogProps extends GenerateClassFormProps {
  /** `menuitem` quand le déclencheur est une entrée de menu, pour la navigation au clavier. */
  triggerRole?: React.AriaRole
  /** Cible de repli du focus quand le déclencheur est devenu inaccessible à la fermeture. */
  restoreFocusRef?: React.RefObject<HTMLElement | null>
}

/**
 * Ouvre la création d'une classe déjà remplie pour un niveau dépourvu de classe sur la période
 * courante : niveau et période sont imposés, seuls le nom et la capacité restent modifiables.
 */
export function GenerateClassDialog({
  triggerRole,
  restoreFocusRef,
  ...props
}: GenerateClassDialogProps) {
  const t = useTranslations('dashboard.pages.levels.generateClass')

  return (
    <Dialog restoreFocusRef={restoreFocusRef}>
      <DialogTrigger>
        <Button variant="outline" size="sm" role={triggerRole}>
          <CalendarPlus className="h-4 w-4" />
          {t('trigger')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title', { level: props.levelName })}</DialogTitle>
        </DialogHeader>
        <GenerateClassForm {...props} />
      </DialogContent>
    </Dialog>
  )
}

function GenerateClassForm({
  levelId,
  levelName,
  periodId,
  periodName,
  defaultCapacity,
}: GenerateClassFormProps) {
  const t = useTranslations('dashboard.pages.levels.generateClass')
  const { isPending, close, onSubmit } = useDialogForm(t)

  const handleSubmit = onSubmit((formData) =>
    createClassPeriodAction({
      name: formData.get('name') as string,
      capacity: Number(formData.get('capacity')),
      levelId,
      periodId,
      teacherIds: [],
    })
  )

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody>
        <div className="space-y-4">
          <p className="text-sm text-graphite-600">
            {t('description', { level: levelName, period: periodName })}
          </p>
          <div className="space-y-2">
            <Label htmlFor="generate-class-name">{t('name')}</Label>
            <Input
              id="generate-class-name"
              name="name"
              required
              maxLength={250}
              defaultValue={`${levelName} ${periodName}`}
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="generate-class-capacity">{t('capacity')}</Label>
            <Input
              id="generate-class-capacity"
              name="capacity"
              type="number"
              min={1}
              defaultValue={defaultCapacity}
              required
              disabled={isPending}
            />
            <p className="text-xs text-graphite-600">{t('capacityHint')}</p>
          </div>
        </div>
      </DialogBody>
      <DialogFormActions t={t} isPending={isPending} onCancel={close} />
    </form>
  )
}
