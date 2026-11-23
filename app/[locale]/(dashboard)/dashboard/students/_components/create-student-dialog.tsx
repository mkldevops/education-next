'use client'

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
import type { PlanOption } from '../../../_lib/plan-options'

// Le formulaire de création ne se charge qu'à l'ouverture du dialogue.
const CreateStudentDialogContent = dynamic(
  () =>
    import('./create-student-dialog-content').then((module) => module.CreateStudentDialogContent),
  { loading: () => <DialogContentLoading /> }
)

interface CreateStudentDialogProps {
  familyId: string
  /** Nom de la famille, proposé comme nom de l'élève (modifiable). */
  familyName?: string
  /** Plans et classes de la période sélectionnée : vides, l'inscription n'est pas proposée. */
  plans?: PlanOption[]
  classes?: ClassOption[]
  /** Faux, l'inscription immédiate se fait sans formule ni remise. */
  paymentsEnabled: boolean
  currency: string
  defaultOpen?: boolean
  redirectTo?: string
  /** Page ouverte après la création ; par défaut la fiche de la famille. */
  afterCreateHref?: string
  showTrigger?: boolean
}

export function CreateStudentDialog({
  familyId,
  familyName,
  plans = [],
  classes = [],
  paymentsEnabled,
  currency,
  defaultOpen = false,
  redirectTo,
  afterCreateHref,
  showTrigger = true,
}: CreateStudentDialogProps) {
  const t = useTranslations('dashboard.pages.students.create')
  const routeAfterOpen = redirectTo ?? `/dashboard/families/${familyId}`

  return (
    <Dialog initialOpen={defaultOpen}>
      <DialogRouteOpener open={defaultOpen} cleanUrl={routeAfterOpen} />
      {showTrigger && (
        <DialogTrigger>
          <Button size="sm">
            <Plus className="h-4 w-4" />
            {t('title')}
          </Button>
        </DialogTrigger>
      )}
      <DialogWhenOpen>
        <CreateStudentDialogContent
          familyId={familyId}
          familyName={familyName}
          plans={plans}
          classes={classes}
          paymentsEnabled={paymentsEnabled}
          currency={currency}
          afterCreateHref={afterCreateHref}
        />
      </DialogWhenOpen>
    </Dialog>
  )
}
