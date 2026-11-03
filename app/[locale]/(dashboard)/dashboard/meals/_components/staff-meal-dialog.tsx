'use client'

import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@peaklab/ui'
import { Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { DialogFormActions, useDialogForm } from '@/features/forms'
import type { MealService } from '@/generated/prisma/enums'
import { setStaffMealAction } from '../../../_lib/meal-actions'

export type StaffMealServiceOption = { service: MealService; allowedWeekdays: number[] }

type Props = {
  teachers: Array<{ id: string; name: string }>
  services: StaffMealServiceOption[]
}

export function StaffMealDialog(props: Props) {
  const t = useTranslations('dashboard.pages.meals.staff.add')

  return (
    <Dialog>
      <DialogTrigger>
        <Button variant="outline" size="sm" disabled={props.services.length === 0}>
          <Plus className="h-4 w-4" />
          {t('title')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>
        <StaffMealForm {...props} />
      </DialogContent>
    </Dialog>
  )
}

function StaffMealForm({ teachers, services }: Props) {
  const t = useTranslations('dashboard.pages.meals.staff.add')
  const tServices = useTranslations('dashboard.pages.meals.services')
  const tWeekdays = useTranslations('dashboard.pages.meals.weekdays')
  const { isPending, close, onSubmit } = useDialogForm(t)
  const [teacherId, setTeacherId] = useState('')
  const [service, setService] = useState<MealService>(services[0]?.service ?? 'CANTEEN')
  const allowed = services.find((option) => option.service === service)?.allowedWeekdays ?? []

  const teacherItems = teachers.map((teacher) => ({ value: teacher.id, label: teacher.name }))
  const serviceItems = services.map((option) => ({
    value: option.service,
    label: tServices(option.service),
  }))

  const handleSubmit = onSubmit((formData) =>
    setStaffMealAction({
      teacherId,
      service,
      weekdays: formData.getAll('weekday').map(Number),
      isFree: formData.get('isFree') === 'on',
    })
  )

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="staff-meal-teacher">{t('teacher')}</Label>
            <Select
              items={teacherItems}
              required
              disabled={isPending}
              value={teacherId}
              onValueChange={(value) => setTeacherId(value ?? '')}
            >
              <SelectTrigger id="staff-meal-teacher">
                <SelectValue placeholder={t('teacherPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {teacherItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-graphite-600">{t('teacherHint')}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="staff-meal-service">{t('service')}</Label>
            <Select
              items={serviceItems}
              required
              disabled={isPending}
              value={service}
              onValueChange={(value) => value && setService(value as MealService)}
            >
              <SelectTrigger id="staff-meal-service">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {serviceItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-graphite">{t('weekdays')}</legend>
            <div key={service} className="flex flex-wrap gap-x-4 gap-y-2">
              {allowed.map((day) => (
                <label key={day} className="flex items-center gap-2 text-sm text-graphite">
                  <input
                    type="checkbox"
                    name="weekday"
                    value={day}
                    defaultChecked
                    className="rounded"
                    disabled={isPending}
                  />
                  {tWeekdays(String(day))}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="flex items-start gap-2 text-sm text-graphite">
            <input type="checkbox" name="isFree" className="mt-0.5 rounded" disabled={isPending} />
            <span>
              <span className="font-medium">{t('isFree')}</span>
              <span className="block text-xs text-graphite-600">{t('isFreeHint')}</span>
            </span>
          </label>
        </div>
      </DialogBody>
      <DialogFormActions t={t} isPending={isPending} onCancel={close} />
    </form>
  )
}
