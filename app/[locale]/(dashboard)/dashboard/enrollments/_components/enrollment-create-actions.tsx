'use client'

import { useState } from 'react'
import type { FamilyOption } from '../../_components/family-picker-dialog'
import { AddStudentButton } from '../../students/_components/add-student-button'
import {
  CreateEnrollmentDialog,
  type CreateEnrollmentDialogProps,
} from './create-enrollment-dialog'

/**
 * Bouton « Nouvelle inscription » de la liste : un enfant absent du sélecteur se crée sur
 * place (famille, puis fiche élève inscrite) sans passer par la page Élèves.
 */
export function EnrollmentCreateActions({
  families,
  ...dialogProps
}: Omit<CreateEnrollmentDialogProps, 'onAddStudent'> & { families: FamilyOption[] }) {
  const [pickerKey, setPickerKey] = useState(0)

  return (
    <>
      <CreateEnrollmentDialog
        {...dialogProps}
        onAddStudent={() => setPickerKey((key) => key + 1)}
      />
      {pickerKey > 0 && (
        <AddStudentButton
          key={pickerKey}
          families={families}
          plans={dialogProps.plans}
          classes={dialogProps.classes}
          paymentsEnabled={dialogProps.paymentsEnabled}
          currency={dialogProps.currency}
          defaultOpen
          showTrigger={false}
          redirectTo="/dashboard/enrollments"
          afterCreateHref="/dashboard/enrollments"
        />
      )}
    </>
  )
}
