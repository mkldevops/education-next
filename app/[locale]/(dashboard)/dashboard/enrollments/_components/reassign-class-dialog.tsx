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
  useDialog,
} from '@peaklab/ui'
import { useTranslations } from 'next-intl'
import { useTransition } from 'react'
import { useRouter } from '@/i18n/routing'
import { toast, toastActionError } from '@/lib/toast'
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
  const { setOpen } = useDialog()
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const availableClasses = classes.filter((c) => c.id !== currentClassId)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = await reassignClassAction({
        enrollmentId,
        newClassPeriodId: formData.get('newClassPeriodId') as string,
      })
      if (result !== 'OK') {
        toastActionError(t, result)
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
            <Label htmlFor="reassign-class">{t('selectClass')}</Label>
            <select
              id="reassign-class"
              name="newClassPeriodId"
              required
              disabled={isPending || availableClasses.length === 0}
              className="flex h-10 w-full rounded border border-gray-300 bg-transparent px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              {availableClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {availableClasses.length === 0 && (
              <p className="text-xs text-amber-700">{t('noClassAvailable')}</p>
            )}
          </div>
        </div>
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
          {t('cancel')}
        </Button>
        <Button type="submit" disabled={isPending || availableClasses.length === 0}>
          {isPending ? '...' : t('submit')}
        </Button>
      </DialogFooter>
    </form>
  )
}
