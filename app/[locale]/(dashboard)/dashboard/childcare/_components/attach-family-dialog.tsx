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
import { ArrowLeft, Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useId, useState } from 'react'
import { DialogFormActions, useDialogForm } from '@/features/forms'
import {
  attachChildcareFamilyAction,
  createChildcareFamilyAction,
} from '../../../_lib/childcare-actions'
import { PHONE_PATTERN } from './childcare-form-fields'
import { FamilyCombobox, type FamilyOption } from './family-combobox'

export function AttachFamilyDialog({
  studentId,
  name,
  families,
}: {
  studentId: string
  name: string
  families: FamilyOption[]
}) {
  const t = useTranslations('dashboard.pages.childcare')
  return (
    <Dialog>
      <DialogTrigger>
        <Button variant="outline" size="sm">
          {t('family.attach')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('family.attachTitle', { name })}</DialogTitle>
        </DialogHeader>
        <AttachFamilyForm
          studentId={studentId}
          suggestedName={name.split(' ').at(-1) ?? ''}
          families={families}
        />
      </DialogContent>
    </Dialog>
  )
}

function AttachFamilyForm({
  studentId,
  suggestedName,
  families,
}: {
  studentId: string
  suggestedName: string
  families: FamilyOption[]
}) {
  const t = useTranslations('dashboard.pages.childcare')
  const id = useId()
  const [familyId, setFamilyId] = useState<string | null>(null)
  const [newName, setNewName] = useState<string | null>(null)
  const { isPending, close, onSubmit } = useDialogForm(t)

  if (newName !== null) {
    return (
      <form
        onSubmit={onSubmit(
          (formData) =>
            createChildcareFamilyAction(studentId, {
              name: formData.get('name') as string,
              emergencyContactName: (formData.get('contactName') as string) || undefined,
              emergencyContactPhone: (formData.get('contactPhone') as string) || undefined,
            }),
          { successKey: 'family.created' }
        )}
      >
        <DialogBody>
          <div className="home-rise space-y-4">
            <button
              type="button"
              onClick={() => setNewName(null)}
              disabled={isPending}
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              {t('family.backToList')}
            </button>
            <div className="space-y-2">
              <Label htmlFor={`${id}-name`}>{t('family.newName')}</Label>
              <Input
                id={`${id}-name`}
                name="name"
                defaultValue={newName}
                autoComplete="off"
                maxLength={50}
                required
                autoFocus
                disabled={isPending}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`${id}-contact`}>{t('family.contactName')}</Label>
                <Input
                  id={`${id}-contact`}
                  name="contactName"
                  autoComplete="off"
                  maxLength={250}
                  disabled={isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${id}-phone`}>{t('family.contactPhone')}</Label>
                <Input
                  id={`${id}-phone`}
                  name="contactPhone"
                  autoComplete="off"
                  type="tel"
                  maxLength={20}
                  pattern={PHONE_PATTERN}
                  disabled={isPending}
                />
              </div>
            </div>
            <p className="text-xs text-graphite-600">{t('family.createHint')}</p>
          </div>
        </DialogBody>
        <DialogFormActions
          t={t}
          isPending={isPending}
          onCancel={close}
          submitKey="family.createSubmit"
        />
      </form>
    )
  }

  return (
    <form
      onSubmit={onSubmit(() => attachChildcareFamilyAction(studentId, familyId ?? ''), {
        successKey: 'family.success',
      })}
    >
      <DialogBody>
        <div className="space-y-4">
          <p className="text-sm text-graphite-600">{t('family.attachDescription')}</p>
          <div className="space-y-2">
            <Label htmlFor={`${id}-family`}>{t('family.label')}</Label>
            <FamilyCombobox
              id={`${id}-family`}
              families={families}
              value={familyId}
              onValueChange={setFamilyId}
              onCreate={setNewName}
              disabled={isPending}
            />
            <button
              type="button"
              onClick={() => setNewName(suggestedName)}
              disabled={isPending}
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <Plus className="size-4" aria-hidden="true" />
              {t('family.create')}
            </button>
          </div>
        </div>
      </DialogBody>
      <DialogFormActions
        t={t}
        isPending={isPending}
        onCancel={close}
        submitKey="family.submit"
        submitDisabled={!familyId}
      />
    </form>
  )
}
