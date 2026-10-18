'use client'

import { useTranslations } from 'next-intl'
import { type FamilyOption, FamilyPickerDialog } from '../../_components/family-picker-dialog'
import { CreateStudentDialog } from './create-student-dialog'

interface Option {
  id: string
  name: string
  amount?: number
}

export function AddStudentButton({
  families,
  plans,
  classes,
  paymentsEnabled,
}: {
  families: FamilyOption[]
  plans: Option[]
  classes: Option[]
  paymentsEnabled: boolean
}) {
  const t = useTranslations('dashboard.pages.students.create')

  return (
    <FamilyPickerDialog
      families={families}
      label={t('title')}
      renderDialog={(family) => (
        <CreateStudentDialog
          familyId={family.id}
          plans={plans}
          classes={classes}
          paymentsEnabled={paymentsEnabled}
          defaultOpen
          showTrigger={false}
          redirectTo="/dashboard/students"
        />
      )}
    />
  )
}
