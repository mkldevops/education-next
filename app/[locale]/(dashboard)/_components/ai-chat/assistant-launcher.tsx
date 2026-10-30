'use client'

import { Button } from '@peaklab/ui'
import { Sparkles, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { usePathname } from '@/i18n/routing'
import { AssistantChat } from './assistant-chat'

const ASSISTANT_PAGE_PATH = '/dashboard/enroll-assistant'

type Props = { model: string }

/**
 * Assistant général, présent sur tout le tableau de bord de l'administrateur.
 *
 * Monté dans le layout, il garde la conversation d'une page à l'autre. Il s'efface sur la
 * page dédiée, qui porte sa propre conversation en pleine largeur.
 */
export function AssistantLauncher({ model }: Props) {
  const t = useTranslations('dashboard.assistant')
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  if (pathname === ASSISTANT_PAGE_PATH) return null

  return (
    <>
      {open ? null : (
        <Button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed right-4 bottom-4 z-40 rounded-full shadow-lg sm:right-6 sm:bottom-6"
          aria-label={t('open')}
        >
          <Sparkles className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">{t('launcher')}</span>
        </Button>
      )}

      <aside
        aria-label={t('title')}
        hidden={!open}
        className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-border bg-background shadow-xl sm:w-[28rem]"
      >
        <header className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
          <Sparkles className="h-4 w-4 text-foreground" aria-hidden />
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold">{t('title')}</h2>
            <p className="truncate text-xs text-muted-foreground">{t('subtitle')}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setOpen(false)}
            aria-label={t('close')}
          >
            <X className="h-4 w-4" aria-hidden />
          </Button>
        </header>
        <AssistantChat
          model={model}
          className="min-h-0 flex-1 p-4"
          listClassName="max-h-none flex-1"
        />
      </aside>
    </>
  )
}
