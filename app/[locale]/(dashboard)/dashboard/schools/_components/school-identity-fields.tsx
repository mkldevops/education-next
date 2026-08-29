'use client'

import { Input, Label } from '@peaklab/ui'
import { useTranslations } from 'next-intl'

type Props = {
  idPrefix: string
  disabled: boolean
  defaults?: {
    name: string
    slug: string
    address: string
    postCode: string
    city: string
  }
}

export type SchoolIdentityInput = {
  name: string
  slug: string
  address?: string
  postCode?: string
  city?: string
}

/** Une chaîne vide n'est pas une adresse : la colonne reste absente plutôt que vide. */
const optional = (value: FormDataEntryValue | null) => {
  const text = ((value as string | null) ?? '').trim()
  return text.length > 0 ? text : undefined
}

export function readSchoolIdentity(formData: FormData): SchoolIdentityInput {
  return {
    name: ((formData.get('name') as string) ?? '').trim(),
    slug: ((formData.get('slug') as string) ?? '').trim(),
    address: optional(formData.get('address')),
    postCode: optional(formData.get('postCode')),
    city: optional(formData.get('city')),
  }
}

export function SchoolIdentityFields({ idPrefix, disabled, defaults }: Props) {
  const t = useTranslations('schools.admin.fields')

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-name`}>{t('name')}</Label>
        <Input
          id={`${idPrefix}-name`}
          name="name"
          required
          maxLength={250}
          defaultValue={defaults?.name}
          disabled={disabled}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-slug`}>{t('slug')}</Label>
        <Input
          id={`${idPrefix}-slug`}
          name="slug"
          required
          maxLength={80}
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          defaultValue={defaults?.slug}
          disabled={disabled}
        />
        <p className="text-xs text-gray-500">{t('slugHint')}</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-address`}>{t('address')}</Label>
        <Input
          id={`${idPrefix}-address`}
          name="address"
          maxLength={250}
          defaultValue={defaults?.address}
          disabled={disabled}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-postCode`}>{t('postCode')}</Label>
          <Input
            id={`${idPrefix}-postCode`}
            name="postCode"
            maxLength={10}
            defaultValue={defaults?.postCode}
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-city`}>{t('city')}</Label>
          <Input
            id={`${idPrefix}-city`}
            name="city"
            maxLength={250}
            defaultValue={defaults?.city}
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  )
}
