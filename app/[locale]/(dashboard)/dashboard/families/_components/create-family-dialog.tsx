'use client'

import { Button, Dialog, DialogContentLoading, DialogTrigger, DialogWhenOpen } from '@peaklab/ui'
import { Plus } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useTranslations } from 'next-intl'
import { DEFAULT_CURRENCY } from '@/lib/decimal'
import type { ClassOption } from '../../../_lib/class-options'
import type { PlanOption } from '../../../_lib/plan-options'

// L'assistant de création ne se charge qu'à l'ouverture du dialogue.
const CreateFamilyDialogContent = dynamic(
  () => import('./create-family-dialog-content').then((module) => module.CreateFamilyDialogContent),
  { loading: () => <DialogContentLoading /> }
)

export interface CreateFamilyDialogProps {
  defaultOpen?: boolean
  /** Plans et classes de la période sélectionnée : vides, l'inscription n'est pas proposée. */
  plans?: PlanOption[]
  classes?: ClassOption[]
  /** Faux, l'inscription se fait sans formule. */
  paymentsEnabled?: boolean
  /** Devise de l'école, pour l'échéancier d'une arrivée en cours d'année. */
  currency?: string
}

export function CreateFamilyDialog({
  defaultOpen = false,
  plans = [],
  classes = [],
  paymentsEnabled = true,
  currency = DEFAULT_CURRENCY,
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
      <DialogWhenOpen>
        <CreateFamilyDialogContent
          defaultOpen={defaultOpen}
          plans={plans}
          classes={classes}
          paymentsEnabled={paymentsEnabled}
          currency={currency}
        />
      </DialogWhenOpen>
    </Dialog>
  )
}
