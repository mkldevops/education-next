'use client'

import { Input, Label } from '@peaklab/ui'
import { useTranslations } from 'next-intl'

export function readTeacherInput(formData: FormData) {
  return {
    firstName: formData.get('firstName') as string,
    lastName: formData.get('lastName') as string,
    email: formData.get('email') as string,
    phone: formData.get('phone') as string,
  }
}

export function TeacherFields({
  idPrefix,
  disabled,
  defaults,
}: {
  idPrefix: string
  disabled: boolean
  defaults?: { firstName: string; lastName: string; email: string | null; phone: string | null }
}) {
  const t = useTranslations('dashboard.pages.teachers.create')

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-first-name`}>{t('firstName')}</Label>
        <Input
          id={`${idPrefix}-first-name`}
          name="firstName"
          defaultValue={defaults?.firstName}
          required
          maxLength={250}
          disabled={disabled}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-last-name`}>{t('lastName')}</Label>
        <Input
          id={`${idPrefix}-last-name`}
          name="lastName"
          defaultValue={defaults?.lastName}
          required
          maxLength={250}
          disabled={disabled}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-email`}>{t('email')}</Label>
        <Input
          id={`${idPrefix}-email`}
          name="email"
          type="email"
          defaultValue={defaults ? (defaults.email ?? '') : undefined}
          maxLength={250}
          disabled={disabled}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-phone`}>{t('phone')}</Label>
        <Input
          id={`${idPrefix}-phone`}
          name="phone"
          defaultValue={defaults ? (defaults.phone ?? '') : undefined}
          maxLength={20}
          disabled={disabled}
        />
      </div>
    </div>
  )
}
