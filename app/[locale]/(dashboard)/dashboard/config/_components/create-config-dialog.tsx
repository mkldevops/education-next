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
import { Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { DialogFormActions, useDialogForm } from '@/features/forms'
import { useRouter } from '@/i18n/routing'
import { setConfigAction } from '../../../_lib/config-actions'

export function CreateConfigDialog() {
  const t = useTranslations('dashboard.pages.config.create')

  return (
    <Dialog>
      <DialogTrigger>
        <Button>
          <Plus className="h-4 w-4" />
          {t('title')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>
        <CreateConfigForm />
      </DialogContent>
    </Dialog>
  )
}

function CreateConfigForm() {
  const t = useTranslations('dashboard.pages.config.create')
  const { isPending, close, onSubmit } = useDialogForm(t)
  const router = useRouter()
  const [valueType, setValueType] = useState<'TEXT' | 'NUMBER' | 'BOOLEAN' | 'COLOR'>('TEXT')

  const handleSubmit = onSubmit(
    (formData) => {
      const value =
        valueType === 'BOOLEAN'
          ? formData.get('value')
            ? 'true'
            : 'false'
          : (formData.get('value') as string)

      return setConfigAction({
        name: formData.get('name') as string,
        value,
        valueType,
      })
    },
    { onSuccess: () => router.refresh() }
  )

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="config-name">{t('name')}</Label>
            <Input id="config-name" name="name" required maxLength={250} disabled={isPending} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="config-type">{t('valueType')}</Label>
            <select
              id="config-type"
              value={valueType}
              onChange={(e) =>
                setValueType(e.target.value as 'TEXT' | 'NUMBER' | 'BOOLEAN' | 'COLOR')
              }
              disabled={isPending}
              className="flex h-10 w-full rounded border border-alabaster bg-transparent px-3 py-2 text-sm"
            >
              <option value="TEXT">{t('types.TEXT')}</option>
              <option value="NUMBER">{t('types.NUMBER')}</option>
              <option value="BOOLEAN">{t('types.BOOLEAN')}</option>
              <option value="COLOR">{t('types.COLOR')}</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="config-value">{t('value')}</Label>
            {valueType === 'BOOLEAN' ? (
              <label className="flex items-center gap-2 text-sm">
                <input
                  id="config-value"
                  name="value"
                  type="checkbox"
                  disabled={isPending}
                  className="h-4 w-4 rounded border-alabaster"
                />
                {t('enabled')}
              </label>
            ) : valueType === 'COLOR' ? (
              <input
                id="config-value"
                name="value"
                type="color"
                defaultValue="#3c6e71"
                required
                disabled={isPending}
                className="h-10 w-16 cursor-pointer rounded border border-alabaster p-1"
              />
            ) : (
              <Input
                id="config-value"
                name="value"
                type={valueType === 'NUMBER' ? 'number' : 'text'}
                step={valueType === 'NUMBER' ? 'any' : undefined}
                required
                disabled={isPending}
              />
            )}
          </div>
        </div>
      </DialogBody>
      <DialogFormActions t={t} isPending={isPending} onCancel={close} />
    </form>
  )
}
