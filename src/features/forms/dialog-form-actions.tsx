'use client'

import type { ButtonProps } from '@peaklab/ui'
import { Button, DialogFooter } from '@peaklab/ui'
import type { useTranslations } from 'next-intl'
import type { ReactNode } from 'react'

type Translator = ReturnType<typeof useTranslations>

interface DialogFormActionsProps {
  t: Translator
  isPending: boolean
  onCancel: () => void
  submitKey?: string
  submitVariant?: ButtonProps['variant']
  children?: ReactNode
  className?: string
}

export function DialogFormActions({
  t,
  isPending,
  onCancel,
  submitKey = 'submit',
  submitVariant,
  children,
  className,
}: DialogFormActionsProps) {
  return (
    <DialogFooter className={className}>
      {children}
      <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
        {t('cancel')}
      </Button>
      <Button type="submit" variant={submitVariant} disabled={isPending}>
        {isPending ? '...' : t(submitKey)}
      </Button>
    </DialogFooter>
  )
}
