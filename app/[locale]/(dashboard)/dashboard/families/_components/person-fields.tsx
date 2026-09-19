'use client'

import { Input, Label, Select } from '@peaklab/ui'
import type { useTranslations } from 'next-intl'
import type { EditablePerson } from './edit-person-dialog'

interface PersonFieldsProps {
  t: ReturnType<typeof useTranslations>
  idPrefix: string
  isPending: boolean
  defaults?: EditablePerson
}

export function PersonFields({ t, idPrefix, isPending, defaults }: PersonFieldsProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-name`}>{t('firstname')}</Label>
          <Input
            id={`${idPrefix}-name`}
            name="name"
            required
            maxLength={250}
            defaultValue={defaults?.name}
            disabled={isPending}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-lastname`}>{t('lastname')}</Label>
          <Input
            id={`${idPrefix}-lastname`}
            name="lastname"
            required
            maxLength={250}
            defaultValue={defaults?.lastname}
            disabled={isPending}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-sex`}>{t('sex')}</Label>
          <Select
            id={`${idPrefix}-sex`}
            name="sex"
            defaultValue={defaults?.sex ?? ''}
            disabled={isPending}
          >
            <option value="">{t('unspecified')}</option>
            <option value="MALE">{t('male')}</option>
            <option value="FEMALE">{t('female')}</option>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-relation`}>{t('relationType')}</Label>
          <Select
            id={`${idPrefix}-relation`}
            name="relationType"
            required
            defaultValue={defaults?.relationType}
            disabled={isPending}
          >
            <option value="PARENT">{t('parent')}</option>
            <option value="TUTOR">{t('tutor')}</option>
            <option value="GRANDPARENT">{t('grandparent')}</option>
            <option value="SIBLING">{t('sibling')}</option>
            <option value="OTHER">{t('other')}</option>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-email`}>{t('email')}</Label>
          <Input
            id={`${idPrefix}-email`}
            name="email"
            type="email"
            maxLength={250}
            defaultValue={defaults?.email ?? ''}
            disabled={isPending}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-phone`}>{t('phone')}</Label>
          <Input
            id={`${idPrefix}-phone`}
            name="phoneNumber"
            type="tel"
            maxLength={20}
            defaultValue={defaults?.phoneNumber ?? ''}
            disabled={isPending}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-address`}>{t('address')}</Label>
        <Input
          id={`${idPrefix}-address`}
          name="address"
          maxLength={250}
          defaultValue={defaults?.address ?? ''}
          disabled={isPending}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-postcode`}>{t('postCode')}</Label>
          <Input
            id={`${idPrefix}-postcode`}
            name="postCode"
            maxLength={10}
            defaultValue={defaults?.postCode ?? ''}
            disabled={isPending}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-city`}>{t('city')}</Label>
          <Input
            id={`${idPrefix}-city`}
            name="city"
            maxLength={250}
            defaultValue={defaults?.city ?? ''}
            disabled={isPending}
          />
        </div>
      </div>
    </div>
  )
}
