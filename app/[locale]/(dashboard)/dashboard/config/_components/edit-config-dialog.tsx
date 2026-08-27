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
import { useTranslations } from 'next-intl'
import { DialogFormActions, useDialogForm } from '@/features/forms'
import { useRouter } from '@/i18n/routing'
import { BRANDING_CONFIG_KEYS } from '@/lib/branding-config'
import { setConfigAction } from '../../../_lib/config-actions'
import { ImageValueField } from './image-value-field'

const IMAGE_CONFIG_NAMES: string[] = [BRANDING_CONFIG_KEYS.logoUrl, BRANDING_CONFIG_KEYS.faviconUrl]

interface EditConfigDialogProps {
  config: {
    name: string
    value: string
    valueType: 'TEXT' | 'NUMBER' | 'BOOLEAN' | 'COLOR'
  }
}

export function EditConfigDialog({ config }: EditConfigDialogProps) {
  const t = useTranslations('dashboard.pages.config.edit')

  return (
    <Dialog>
      <DialogTrigger>
        <Button variant="outline" size="sm">
          {t('title')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t('title')} — {config.name}
          </DialogTitle>
        </DialogHeader>
        <EditConfigForm config={config} />
      </DialogContent>
    </Dialog>
  )
}

function EditConfigForm({ config }: EditConfigDialogProps) {
  const t = useTranslations('dashboard.pages.config.edit')
  const { isPending, close, onSubmit } = useDialogForm(t)
  const router = useRouter()

  const handleSubmit = onSubmit(
    (formData) => {
      const value =
        config.valueType === 'BOOLEAN'
          ? formData.get('value')
            ? 'true'
            : 'false'
          : (formData.get('value') as string)

      return setConfigAction({
        name: config.name,
        value,
        valueType: config.valueType,
      })
    },
    { onSuccess: () => router.refresh() }
  )

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-config-value">{t('value')}</Label>
            {IMAGE_CONFIG_NAMES.includes(config.name) ? (
              <ImageValueField
                id="edit-config-value"
                name="value"
                defaultValue={config.value}
                disabled={isPending}
              />
            ) : config.valueType === 'BOOLEAN' ? (
              <label className="flex items-center gap-2 text-sm">
                <input
                  id="edit-config-value"
                  name="value"
                  type="checkbox"
                  defaultChecked={config.value === 'true'}
                  disabled={isPending}
                  className="h-4 w-4 rounded border-gray-300"
                />
                {config.value === 'true' ? t('true') : t('false')}
              </label>
            ) : config.valueType === 'COLOR' ? (
              <div className="flex items-center gap-3">
                <input
                  id="edit-config-value"
                  name="value"
                  type="color"
                  defaultValue={config.value}
                  required
                  disabled={isPending}
                  className="h-10 w-16 cursor-pointer rounded border border-gray-300 p-1"
                />
                <Input
                  name="color-text"
                  type="text"
                  defaultValue={config.value}
                  pattern="^#[0-9a-fA-F]{6}$"
                  placeholder={t('colorPlaceholder')}
                  disabled={isPending}
                  className="flex-1"
                  onChange={(e) => {
                    const colorInput = e.currentTarget
                      .closest('form')
                      ?.querySelector<HTMLInputElement>('#edit-config-value')
                    if (colorInput && /^#[0-9a-fA-F]{6}$/.test(e.target.value)) {
                      colorInput.value = e.target.value
                    }
                  }}
                />
              </div>
            ) : (
              <Input
                id="edit-config-value"
                name="value"
                type={config.valueType === 'NUMBER' ? 'number' : 'text'}
                step={config.valueType === 'NUMBER' ? 'any' : undefined}
                defaultValue={config.value}
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
