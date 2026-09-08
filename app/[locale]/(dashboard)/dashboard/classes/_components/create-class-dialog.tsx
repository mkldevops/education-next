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
  MultiSelect,
  Select,
} from '@peaklab/ui'
import { Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { DialogFormActions, useDialogForm } from '@/features/forms'
import { createClassPeriodAction } from '../../../_lib/class-period-actions'

interface Option {
  id: string
  name: string
}

interface CreateClassDialogProps {
  levels: Option[]
  periods: Option[]
  teachers: Option[]
  defaultCapacity?: number
}

export function CreateClassDialog({
  levels,
  periods,
  teachers,
  defaultCapacity,
}: CreateClassDialogProps) {
  const t = useTranslations('dashboard.pages.classes.create')

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
        <CreateClassForm
          levels={levels}
          periods={periods}
          teachers={teachers}
          defaultCapacity={defaultCapacity}
        />
      </DialogContent>
    </Dialog>
  )
}

function CreateClassForm({ levels, periods, teachers, defaultCapacity }: CreateClassDialogProps) {
  const t = useTranslations('dashboard.pages.classes.create')
  const { isPending, close, onSubmit } = useDialogForm(t)

  const handleSubmit = onSubmit((formData) =>
    createClassPeriodAction({
      name: formData.get('name') as string,
      capacity: Number(formData.get('capacity')),
      levelId: formData.get('levelId') as string,
      periodId: formData.get('periodId') as string,
      teacherIds: formData.getAll('teacherIds').map(String),
    })
  )

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="class-name">{t('name')}</Label>
            <Input
              id="class-name"
              name="name"
              required
              maxLength={250}
              placeholder={t('namePlaceholder')}
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="class-capacity">{t('capacity')}</Label>
            <Input
              id="class-capacity"
              name="capacity"
              type="number"
              min={1}
              defaultValue={defaultCapacity}
              required
              disabled={isPending}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="class-level">{t('selectLevel')}</Label>
              <Select id="class-level" name="levelId" required disabled={isPending}>
                {levels.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="class-period">{t('selectPeriod')}</Label>
              <Select id="class-period" name="periodId" required disabled={isPending}>
                {periods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="class-teachers">{t('teachers')}</Label>
            <MultiSelect
              id="class-teachers"
              name="teacherIds"
              options={teachers}
              disabled={isPending}
              placeholder={t('teachersPlaceholder')}
              searchPlaceholder={t('teachersSearch')}
              emptyMessage={t('teachersEmpty')}
              noResultsMessage={t('teachersNoResults')}
              removeLabel={t('teachersRemove')}
            />
            <p className="text-xs text-graphite-600">{t('teachersHint')}</p>
          </div>
        </div>
      </DialogBody>
      <DialogFormActions t={t} isPending={isPending} onCancel={close} />
    </form>
  )
}
