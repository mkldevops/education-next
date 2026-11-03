'use client'

import { EyeOff } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { type ReactNode, useTransition } from 'react'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { setWidgetHiddenAction } from '../_lib/home-widget-actions'
import type { HomeWidget } from '../_lib/home-widgets'

interface Props {
  widget: HomeWidget
  className?: string
  children: ReactNode
}

export function HideableWidget({ widget, className, children }: Props) {
  const t = useTranslations('dashboard.home.customize')
  const [pending, startTransition] = useTransition()
  const label = t(`widgets.${widget}.label`)

  const hide = () => {
    startTransition(async () => {
      const result = await setWidgetHiddenAction({ widget, hidden: true })
      if (result !== 'OK') {
        toast.error(t('error'))
        return
      }
      toast.success(t('hidden', { name: label }), {
        duration: 8000,
        action: {
          label: t('undo'),
          onClick: () => {
            void setWidgetHiddenAction({ widget, hidden: false })
          },
        },
      })
    })
  }

  return (
    <div className={cn('group/widget relative', pending && 'opacity-50', className)}>
      {children}
      <button
        type="button"
        onClick={hide}
        disabled={pending}
        aria-label={t('hide', { name: label })}
        title={t('hide', { name: label })}
        className={cn(
          'absolute -top-2.5 -right-2.5 z-10 flex size-7 items-center justify-center rounded-full border border-border bg-surface text-muted-foreground shadow-sm',
          'opacity-0 transition-opacity duration-(--duration-fast) group-hover/widget:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100',
          'hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'
        )}
      >
        <EyeOff size={14} aria-hidden="true" />
      </button>
    </div>
  )
}
