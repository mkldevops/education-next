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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@peaklab/ui'
import { useTranslations } from 'next-intl'
import { DialogFormActions, useDialogForm } from '@/features/forms'
import type { ConfigValueType } from '@/generated/prisma/client'
import { useRouter } from '@/i18n/routing'
import { ATTENDANCE_FREQUENCY_CONFIG_KEY } from '@/lib/attendance-config'
import { BRANDING_CONFIG_KEYS } from '@/lib/branding-config'
import {
  CLASS_SCHEDULE_VISIBILITY_CONFIG_KEY,
  ClassScheduleVisibility,
} from '@/lib/class-schedule-config'
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
  const tVisibility = useTranslations('dashboard.pages.config.settings.class_schedule_visibility')
  const tFrequency = useTranslations('dashboard.pages.config.settings.attendance_frequency')
  const { isPending, close, onSubmit } = useDialogForm(t)
  const router = useRouter()
  const frequencyItems = [
    { value: 'PER_SLOT', label: tFrequency('perSlot') },
    { value: 'DAILY', label: tFrequency('daily') },
  ]
  const visibilityItems = [
    { value: ClassScheduleVisibility.Internal, label: tVisibility('internal') },
    { value: ClassScheduleVisibility.Public, label: tVisibility('public') },
  ]
  const selectItems =
    config.name === ATTENDANCE_FREQUENCY_CONFIG_KEY ? frequencyItems : visibilityItems
  const selectDefault =
    selectItems.find((item) => item.value === config.value)?.value ?? selectItems[0]?.value

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
            ) : config.name === CLASS_SCHEDULE_VISIBILITY_CONFIG_KEY ||
              config.name === ATTENDANCE_FREQUENCY_CONFIG_KEY ? (
              <Select
                name="value"
                items={selectItems}
                defaultValue={selectDefault}
                disabled={isPending}
              >
                <SelectTrigger id="edit-config-value">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {selectItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
