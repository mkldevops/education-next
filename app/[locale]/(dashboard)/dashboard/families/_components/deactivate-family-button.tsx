'use client'

import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogRouteOpener,
  DialogTitle,
  DialogTrigger,
} from '@peaklab/ui'
import { useTranslations } from 'next-intl'
import { DialogFormActions, useDialogForm } from '@/features/forms'
import { useRouter } from '@/i18n/routing'
import { deactivateFamilyAction } from '../../../_lib/family-actions'

type DeactivateFamilyButtonProps = {
  familyId: string
  defaultOpen?: boolean
  redirectTo?: string
  showTrigger?: boolean
}

export function DeactivateFamilyButton({
  familyId,
  defaultOpen = false,
  redirectTo,
  showTrigger = true,
}: DeactivateFamilyButtonProps) {
  const t = useTranslations('dashboard.pages.families.deactivate')

  return (
    <Dialog initialOpen={defaultOpen}>
      <DialogRouteOpener open={defaultOpen} cleanUrl={redirectTo} />
      {showTrigger && (
        <DialogTrigger>
          <Button variant="destructive" size="sm">
            {t('title')}
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
  const { isPending, close, onSubmit } = useDialogForm(t)
  const router = useRouter()

  const handleConfirm = onSubmit(() => deactivateFamilyAction(familyId), {
    onSuccess: () => router.push('/dashboard/families'),
  })

  return (
    <form onSubmit={handleConfirm}>
      <DialogBody>
        <p className="text-sm text-graphite-600">{t('description')}</p>
      </DialogBody>
      <DialogFormActions
        t={t}
        isPending={isPending}
        onCancel={close}
        submitKey="confirm"
        submitVariant="destructive"
      />
    </form>
  )
}
