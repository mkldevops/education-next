'use client'

import type { ButtonProps } from '@peaklab/ui'
import {
  Button,
  Dialog,
  DialogContentLoading,
  DialogRouteOpener,
  DialogTrigger,
  DialogWhenOpen,
} from '@peaklab/ui'
import { Plus } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useTranslations } from 'next-intl'
import type { ClassOption } from '../../../_lib/class-options'
import type { StudentOption } from '../_lib/enrollment-options'

// Le formulaire et ses sélecteurs guidés ne se chargent qu'à l'ouverture du dialogue.
const CreateEnrollmentDialogContent = dynamic(
  () =>
    import('./create-enrollment-dialog-content').then(
      (module) => module.CreateEnrollmentDialogContent
    ),
  { loading: () => <DialogContentLoading /> }
)

interface PlanOption {
  id: string
  name: string
  amount?: number
}

export interface CreateEnrollmentDialogProps {
  students: StudentOption[]
  plans: PlanOption[]
  classes: ClassOption[]
  paymentsEnabled: boolean
  currency: string
  defaultOpen?: boolean
  defaultStudentId?: string
  redirectTo?: string
  showTrigger?: boolean
  triggerSize?: ButtonProps['size']
}

export function CreateEnrollmentDialog({
  students,
  plans,
  classes,
  paymentsEnabled,
  currency,
  defaultOpen = false,
  defaultStudentId,
  redirectTo,
  showTrigger = true,
  triggerSize,
}: CreateEnrollmentDialogProps) {
  const t = useTranslations('dashboard.pages.enrollments.create')

  return (
    <Dialog initialOpen={defaultOpen}>
      <DialogRouteOpener open={defaultOpen} cleanUrl={redirectTo ?? '/dashboard/enrollments'} />
      {showTrigger && (
        <DialogTrigger>
          <Button size={triggerSize}>
            <Plus className="h-4 w-4" />
            {t('title')}
          </Button>
        </DialogTrigger>
      )}
      <DialogWhenOpen>
        <CreateEnrollmentDialogContent
          students={students}
          plans={plans}
          classes={classes}
          paymentsEnabled={paymentsEnabled}
          currency={currency}
          defaultStudentId={defaultStudentId}
          redirectTo={redirectTo}
        />
      </DialogWhenOpen>
    </Dialog>
  )
}
