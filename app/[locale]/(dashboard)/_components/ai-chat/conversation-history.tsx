'use client'

import { Button } from '@peaklab/ui'
import type { UIMessage } from 'ai'
import { Loader2, MessageSquare, Trash2 } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { useEffect, useState, useTransition } from 'react'
import { cn } from '@/lib/utils'
import {
  deleteAiConversation,
  listAiConversations,
  loadAiConversation,
} from '../../_lib/ai-conversation-actions'

type Item = Awaited<ReturnType<typeof listAiConversations>>[number]

type Props = {
  activeId: string
  onOpen: (conversation: { id: string; messages: UIMessage[] }) => void
  onDeleted: (id: string) => void
}

/** Conversations enregistrées de l'administrateur, la plus récente en tête. */
export function ConversationHistory({ activeId, onOpen, onDeleted }: Props) {
  const t = useTranslations('dashboard.assistant.history')
  const format = useFormatter()
  const [items, setItems] = useState<Item[] | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    let live = true
    listAiConversations()
      .then((rows) => {
        if (live) setItems(rows)
      })
      .catch(() => {
        if (!live) return
        setItems([])
        setLoadError(true)
      })
    return () => {
      live = false
    }
  }, [])

  const open = (id: string) =>
    startTransition(async () => {
      const result = await loadAiConversation(id)
      if (result === 'notFound') {
        setLoadError(true)
        return
      }
      setLoadError(false)
      onOpen(result)
    })

  const remove = (id: string) =>
    startTransition(async () => {
      await deleteAiConversation(id)
      setItems((current) => current?.filter((item) => item.id !== id) ?? null)
      onDeleted(id)
    })

  return (
    <section
      aria-label={t('title')}
      className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded border border-border bg-surface p-3"
    >
      <p className="text-xs text-muted-foreground">{t('notice')}</p>
      {loadError ? (
        <p className="text-sm text-danger" role="alert">
          {t('loadError')}
        </p>
      ) : null}
      {items === null ? (
        <Loader2 className="m-auto h-4 w-4 animate-spin text-muted-foreground" aria-hidden />
      ) : items.length === 0 ? (
        <p className="m-auto text-sm text-muted-foreground">{t('empty')}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {items.map((item) => (
            <li
              key={item.id}
              className={cn(
                'flex items-center gap-1 rounded',
                item.id === activeId && 'bg-surface-2'
              )}
            >
              <button
                type="button"
                onClick={() => open(item.id)}
                disabled={pending}
                className="flex min-w-0 flex-1 items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-surface-2 disabled:opacity-60"
              >
                <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{item.title}</span>
                  <span className="block text-xs text-muted-foreground">
                    {format.dateTime(new Date(item.updatedAt), {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </span>
                </span>
              </button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => remove(item.id)}
                disabled={pending}
                aria-label={t('delete', { title: item.title })}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
