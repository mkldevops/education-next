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
} from '@peaklab/ui'
import { Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { DialogFormActions, useDialogForm } from '@/features/forms'
import { createTeacherExpenseAction } from '../../../_lib/teacher-actions'

interface TeacherOption {
  id: string
  name: string
}

interface CreateExpenseDialogProps {
  teachers: TeacherOption[]
}

export function CreateExpenseDialog({ teachers }: CreateExpenseDialogProps) {
  const t = useTranslations('dashboard.pages.teachers.expenses.create')

  return (
    <Dialog>
      <DialogTrigger>
        <Button disabled={teachers.length === 0}>
          <Plus className="h-4 w-4" />
          {t('title')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>
        <CreateExpenseForm teachers={teachers} />
      </DialogContent>
    </Dialog>
  )
}

function CreateExpenseForm({ teachers }: CreateExpenseDialogProps) {
  const t = useTranslations('dashboard.pages.teachers.expenses.create')
  const { isPending, close, onSubmit } = useDialogForm(t)

  const handleSubmit = onSubmit((formData) => {
    const requestedAt = new Date(formData.get('requestedAt') as string)
    const paidAtValue = formData.get('paidAt') as string

    return createTeacherExpenseAction({
      teacherId: formData.get('teacherId') as string,
      amount: Number(formData.get('amount')),
      category: formData.get('category') as string,
      description: formData.get('description') as string,
      requestedAt,
      paidAt: paidAtValue ? new Date(paidAtValue) : null,
    })
  })

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="expense-teacher">{t('teacher')}</Label>
            <Select
              id="expense-teacher"
              name="teacherId"
              required
              disabled={isPending || teachers.length === 0}
            >
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="expense-amount">{t('amount')}</Label>
            <Input
              id="expense-amount"
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              required
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="expense-category">{t('category')}</Label>
            <Input
              id="expense-category"
              name="category"
              required
              maxLength={100}
              disabled={isPending}
              placeholder={t('categoryPlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="expense-description">{t('description')}</Label>
            <Input
              id="expense-description"
              name="description"
              required
              maxLength={250}
              disabled={isPending}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="expense-requested-at">{t('requestedAt')}</Label>
              <Input
                id="expense-requested-at"
                name="requestedAt"
                type="date"
                defaultValue={new Date().toISOString().slice(0, 10)}
                required
                disabled={isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expense-paid-at">{t('paidAt')}</Label>
              <Input id="expense-paid-at" name="paidAt" type="date" disabled={isPending} />
            </div>
          </div>
        </div>
      </DialogBody>
      <DialogFormActions t={t} isPending={isPending} onCancel={close} />
    </form>
  )
}
