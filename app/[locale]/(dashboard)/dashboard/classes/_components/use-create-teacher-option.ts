'use client'

import type { MultiSelectOption } from '@peaklab/ui'
import { useTranslations } from 'next-intl'
import { splitTeacherName } from '@/domain/teacher'
import { toast } from '@/lib/toast'
import { createTeacherAction } from '../../../_lib/teacher-actions'

export function useCreateTeacherOption() {
  const t = useTranslations('dashboard.pages.classes.create')

  const onCreate = async (name: string): Promise<MultiSelectOption | null> => {
    const result = await createTeacherAction(splitTeacherName(name))
    if (typeof result === 'string') {
      toast.error(t('teachersCreateError'))
      return null
    }
    toast.success(t('teachersCreated', { name }))
    return { id: result.id, name: `${result.lastName} ${result.firstName}`.trim() }
  }

  return { onCreate, createLabel: (name: string) => t('teachersCreate', { name }) }
}
