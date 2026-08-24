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
  DialogRouteOpener,
  DialogTitle,
  DialogTrigger,
  useDialog,
} from '@/components/ui/dialog/dialog'
import { useRouter } from '@/i18n/routing'
import { toast, toastActionError } from '@/lib/toast'
import { deactivateFamilyAction } from '../../../_lib/family-actions'

type DeactivateFamilyDialogProps = {
  familyId: string
  defaultOpen?: boolean
  redirectTo?: string
  showTrigger?: boolean
  title?: string
}

export function DeactivateFamilyButton(props: DeactivateFamilyDialogProps) {
  const t = useTranslations('dashboard.pages.families.deactivate')

  return <DeactivateFamilyDialog {...props} title={props.title ?? t('title')} />
}

export function DeactivateFamilyDialog({
  familyId,
  defaultOpen = false,
  redirectTo,
  showTrigger = true,
  title,
}: DeactivateFamilyDialogProps) {
  const t = useTranslations('dashboard.pages.families.deactivate')

  return (
    <Dialog initialOpen={defaultOpen}>
      <DialogRouteOpener open={defaultOpen} cleanUrl={redirectTo} />
      {showTrigger && (
        <DialogTrigger>
          <Button variant="destructive" size="sm">
            {title ?? t('title')}
          </Button>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>
        <DeactivateForm familyId={familyId} />
      </DialogContent>
    </Dialog>
  )
}

function DeactivateForm({ familyId }: { familyId: string }) {
  const t = useTranslations('dashboard.pages.families.deactivate')
  const { setOpen } = useDialog()
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      const result = await deactivateFamilyAction(familyId)
      if (result !== 'OK') {
        toastActionError(t, result)
      } else {
        toast.success(t('success'))
        setOpen(false)
        router.push('/dashboard/families')
      }
    })
  }

  return (
    <form onSubmit={handleConfirm}>
      <DialogBody>
        <p className="text-sm text-gray-600">{t('description')}</p>
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
          {t('cancel')}
        </Button>
        <Button type="submit" variant="destructive" disabled={isPending}>
          {isPending ? '...' : t('confirm')}
        </Button>
      </DialogFooter>
    </form>
  )
}
