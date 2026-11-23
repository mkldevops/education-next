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
import type { ConfigValueType } from '@/generated/prisma/client'
import { useRouter } from '@/i18n/routing'
import { BRANDING_CONFIG_KEYS } from '@/lib/branding-config'
import type { SchoolConfigKey } from '@/lib/school-config'
import { setConfigAction } from '../../../_lib/config-actions'
import { ImageValueField } from './image-value-field'

interface EditConfigDialogProps {
  config: {
    name: SchoolConfigKey
    value: string
    valueType: ConfigValueType
  }
  label: string
}

/** Logo et capacité des classes : les valeurs libres, qui demandent une saisie validée. */
export function EditConfigDialog({ config, label }: EditConfigDialogProps) {
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
            {t('title')} — {label}
          </DialogTitle>
        </DialogHeader>
        <EditConfigForm config={config} />
      </DialogContent>
    </Dialog>
  )
}

function EditConfigForm({ config }: Pick<EditConfigDialogProps, 'config'>) {
  const t = useTranslations('dashboard.pages.config.edit')
  const { isPending, close, onSubmit } = useDialogForm(t)
  const router = useRouter()

  const handleSubmit = onSubmit(
    (formData) =>
      setConfigAction({
        name: config.name,
        value: formData.get('value') as string,
      }),
    { onSuccess: () => router.refresh() }
  )

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-config-value">{t('value')}</Label>
            {config.name === BRANDING_CONFIG_KEYS.logoUrl ? (
              <ImageValueField
                id="edit-config-value"
                name="value"
                defaultValue={config.value}
                disabled={isPending}
              />
            ) : (
              <Input
                id="edit-config-value"
                name="value"
                type={config.valueType === 'NUMBER' ? 'number' : 'text'}
                min={config.valueType === 'NUMBER' ? 1 : undefined}
                step={config.valueType === 'NUMBER' ? 1 : undefined}
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
