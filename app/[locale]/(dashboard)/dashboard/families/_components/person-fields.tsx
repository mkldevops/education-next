'use client'

import {
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@peaklab/ui'
import type { useTranslations } from 'next-intl'
import type { EditablePerson } from './edit-person-dialog'

interface PersonFieldsProps {
  t: ReturnType<typeof useTranslations>
  idPrefix: string
  isPending: boolean
  defaults?: EditablePerson
}

export function PersonFields({ t, idPrefix, isPending, defaults }: PersonFieldsProps) {
  const sexItems = [
    { value: null, label: t('unspecified') },
    { value: 'MALE', label: t('male') },
    { value: 'FEMALE', label: t('female') },
  ]
  const relationItems = [
    { value: 'PARENT', label: t('parent') },
    { value: 'TUTOR', label: t('tutor') },
    { value: 'GRANDPARENT', label: t('grandparent') },
    { value: 'SIBLING', label: t('sibling') },
    { value: 'OTHER', label: t('other') },
  ]

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
            name="sex"
            items={sexItems}
            defaultValue={defaults?.sex ?? null}
            disabled={isPending}
          >
            <SelectTrigger id={`${idPrefix}-sex`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sexItems.map((item) => (
                <SelectItem key={item.value ?? ''} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-relation`}>{t('relationType')}</Label>
          <Select
            name="relationType"
            items={relationItems}
            required
            defaultValue={defaults?.relationType ?? relationItems[0]?.value}
            disabled={isPending}
          >
            <SelectTrigger id={`${idPrefix}-relation`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {relationItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
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
