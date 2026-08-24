'use client'

import type { RichDataTableLabels } from '@peaklab/ui'
import { useTranslations } from 'next-intl'

export function useTableLabels(): RichDataTableLabels {
  const t = useTranslations('common.table')

  return {
    search: t('search'),
    noResults: t('noResults'),
    columns: t('columns'),
    rowsPerPage: t('rowsPerPage'),
    previous: t('previous'),
    next: t('next'),
    page: (current, total) => t('page', { current, total }),
  }
}
