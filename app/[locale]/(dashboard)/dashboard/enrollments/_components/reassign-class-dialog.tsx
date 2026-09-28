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
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@peaklab/ui'
import { useTranslations } from 'next-intl'
import { useDialogForm } from '@/features/forms'
import { useRouter } from '@/i18n/routing'
import { reassignClassAction } from '../../../_lib/enrollment-actions'

interface Option {
  id: string
  name: string
}

interface ReassignClassDialogProps {
  enrollmentId: string
  currentClassId: string | null
  classes: Option[]
  triggerLabel?: string
}

export function ReassignClassDialog({
  enrollmentId,
  currentClassId,
  classes,
  triggerLabel,
}: ReassignClassDialogProps) {
  const t = useTranslations('dashboard.pages.enrollmentDetails.reassign')

  return (
    <Dialog>
      <DialogTrigger>
        <Button variant="outline" size="sm">
          {triggerLabel ?? t('title')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>
        <ReassignForm
          enrollmentId={enrollmentId}
          currentClassId={currentClassId}
          classes={classes}
        />
      </DialogContent>
    </Dialog>
  )
}

function ReassignForm({ enrollmentId, currentClassId, classes }: ReassignClassDialogProps) {
  const t = useTranslations('dashboard.pages.enrollmentDetails.reassign')
  const { isPending, close, onSubmit } = useDialogForm(t)
  const router = useRouter()

  const availableClasses = classes.filter((c) => c.id !== currentClassId)
  const classItems = availableClasses.map((c) => ({ value: c.id, label: c.name }))

  const handleSubmit = onSubmit(
    (formData) =>
      reassignClassAction({
        enrollmentId,
        newClassPeriodId: formData.get('newClassPeriodId') as string,
      }),
    { onSuccess: () => router.refresh() }
  )

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reassign-class">{t('selectClass')}</Label>
            <Select
              name="newClassPeriodId"
              items={classItems}
              required
              disabled={isPending || availableClasses.length === 0}
              defaultValue={classItems[0]?.value}
            >
              <SelectTrigger id="reassign-class">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {classItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {availableClasses.length === 0 && (
              <p className="text-xs text-amber-700">{t('noClassAvailable')}</p>
            )}
          </div>
        </div>
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={close} disabled={isPending}>
          {t('cancel')}
        </Button>
        <Button type="submit" disabled={isPending || availableClasses.length === 0}>
          {isPending ? '...' : t('submit')}
        </Button>
      </DialogFooter>
    </form>
  )
}
