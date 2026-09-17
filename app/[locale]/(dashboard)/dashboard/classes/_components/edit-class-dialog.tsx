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
import { useTranslations } from 'next-intl'
import { DialogFormActions, useDialogForm } from '@/features/forms'
import { updateClassPeriodAction } from '../../../_lib/class-period-actions'

interface TeacherOption {
  id: string
  name: string
}

interface EditClassDialogProps {
  classItem: {
    id: string
    name: string
    capacity: number
    levelId: string
    teacherIds: string[]
  }
  levels: TeacherOption[]
  teachers: TeacherOption[]
}

export function EditClassDialog({ classItem, levels, teachers }: EditClassDialogProps) {
  const t = useTranslations('dashboard.pages.classes.edit')

  return (
    <Dialog>
      <DialogTrigger>
        <Button variant="outline" size="sm">
          {t('title')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>
        <EditClassForm classItem={classItem} levels={levels} teachers={teachers} />
      </DialogContent>
    </Dialog>
  )
}

function EditClassForm({ classItem, levels, teachers }: EditClassDialogProps) {
  const t = useTranslations('dashboard.pages.classes.edit')
  const tCreate = useTranslations('dashboard.pages.classes.create')
  const { isPending, close, onSubmit } = useDialogForm(t)

  const handleSubmit = onSubmit((formData) =>
    updateClassPeriodAction(classItem.id, {
      name: formData.get('name') as string,
      capacity: Number(formData.get('capacity')),
      levelId: formData.get('levelId') as string,
      teacherIds: formData.getAll('teacherIds').map(String),
    })
  )

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-class-name">{tCreate('name')}</Label>
            <Input
              id="edit-class-name"
              name="name"
              defaultValue={classItem.name}
              required
              maxLength={250}
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-class-level">{tCreate('selectLevel')}</Label>
            <Select
              id="edit-class-level"
              name="levelId"
              defaultValue={classItem.levelId}
              required
              disabled={isPending}
            >
              {levels.map((level) => (
                <option key={level.id} value={level.id}>
                  {level.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-class-capacity">{tCreate('capacity')}</Label>
            <Input
              id="edit-class-capacity"
              name="capacity"
              type="number"
              min={1}
              defaultValue={classItem.capacity}
              required
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-class-teachers">{tCreate('teachers')}</Label>
            <MultiSelect
              id="edit-class-teachers"
              name="teacherIds"
              options={teachers}
              defaultValue={classItem.teacherIds}
              disabled={isPending}
              placeholder={tCreate('teachersPlaceholder')}
              searchPlaceholder={tCreate('teachersSearch')}
              emptyMessage={tCreate('teachersEmpty')}
              noResultsMessage={tCreate('teachersNoResults')}
              removeLabel={tCreate('teachersRemove')}
            />
            <p className="text-xs text-graphite-600">{tCreate('teachersHint')}</p>
          </div>
        </div>
      </DialogBody>
      <DialogFormActions t={t} isPending={isPending} onCancel={close} />
    </form>
  )
}
