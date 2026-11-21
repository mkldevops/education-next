'use client'

import type { UIMessage } from 'ai'
import {
  ArrowRight,
  ClipboardCheck,
  type LucideIcon,
  MessageSquare,
  Sparkles,
  UserPlus,
  Wallet,
} from 'lucide-react'
import { useFormatter, useLocale, useTranslations } from 'next-intl'
import { type ReactNode, Suspense, use, useEffect, useState, useTransition } from 'react'
import { Link } from '@/i18n/routing'
import { formatCurrency } from '@/lib/decimal'
import { cn } from '@/lib/utils'
import type { AssistantBriefing } from '@/use-cases/ai-assistant/assistant-briefing'
import { listAiConversations, loadAiConversation } from '../../_lib/ai-conversation-actions'

const RECENT_COUNT = 3

type Recent = Awaited<ReturnType<typeof listAiConversations>>[number]

type Props = {
  briefing: Promise<AssistantBriefing>
  currency: string
  composer: ReactNode
  suggestions: string[]
  onPick: (text: string) => void
  onOpen: (conversation: { id: string; messages: UIMessage[] }) => void
  onShowHistory: () => void
}

/**
 * Accueil de la page assistant : ce qui attend l'administrateur aujourd'hui, prêt à être
 * confié à l'assistant, et ses dernières conversations. Une carte ne fait que placer une
 * demande dans le champ ; rien ne part sans son envoi.
 */
export function AssistantWelcome({
  briefing,
  currency,
  composer,
  suggestions,
  onPick,
  onOpen,
  onShowHistory,
}: Props) {
  const t = useTranslations('dashboard.assistant.chat.welcome')

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col items-center gap-3 text-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
          <Sparkles className="h-5 w-5" aria-hidden />
        </span>
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{t('title')}</h2>
        <p className="max-w-md text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      <div className="flex flex-col gap-1">{composer}</div>

      <section aria-labelledby="assistant-today" className="flex flex-col gap-3">
        <h3
          id="assistant-today"
          className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          {t('today.title')}
        </h3>
        <Suspense fallback={<TodaySkeleton />}>
          <TodayCards
            briefing={briefing}
            currency={currency}
            suggestions={suggestions}
            onPick={onPick}
          />
        </Suspense>
      </section>

      <RecentConversations onOpen={onOpen} onShowHistory={onShowHistory} />
    </div>
  )
}

function TodaySkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-3" aria-hidden>
      {[0, 1, 2].map((index) => (
        <div key={index} className="h-32 animate-pulse rounded-2xl bg-surface-2" />
      ))}
    </div>
  )
}

type Tone = 'danger' | 'warning' | 'primary'

const TONES: Record<Tone, string> = {
  danger: 'bg-danger-subtle text-danger',
  warning: 'bg-warning-subtle text-warning',
  primary: 'bg-primary-subtle text-primary',
}

function TodayCards({
  briefing,
  currency,
  suggestions,
  onPick,
}: {
  briefing: Promise<AssistantBriefing>
  currency: string
  suggestions: string[]
  onPick: (text: string) => void
}) {
  const t = useTranslations('dashboard.assistant.chat.welcome.today')
  const locale = useLocale()
  const { overdue, openCalls, pendingEnrollments } = use(briefing)

  const cards: ReactNode[] = []
  if (overdue && overdue.families > 0) {
    cards.push(
      <TodayCard
        key="overdue"
        icon={Wallet}
        tone="danger"
        title={t('overdue.title', { count: overdue.families })}
        detail={t('overdue.detail', { amount: formatCurrency(overdue.amount, locale, currency) })}
        action={t('overdue.action')}
        onClick={() => onPick(t('overdue.prompt'))}
      />
    )
  }
  if (openCalls && openCalls.count > 0) {
    cards.push(
      <TodayCard
        key="calls"
        icon={ClipboardCheck}
        tone="warning"
        title={t('calls.title', { count: openCalls.count })}
        detail={openCalls.classes.join(', ')}
        action={t('calls.action')}
        onClick={() => onPick(t('calls.prompt'))}
      />
    )
  }
  if (pendingEnrollments && pendingEnrollments > 0) {
    cards.push(
      <TodayCard
        key="enrollments"
        icon={UserPlus}
        tone="primary"
        title={t('enrollments.title', { count: pendingEnrollments })}
        detail={t('enrollments.detail')}
        action={t('enrollments.action')}
        href="/dashboard/enrollments"
      />
    )
  }

  if (cards.length === 0) {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-border p-4">
        <p className="text-sm text-muted-foreground">{t('none')}</p>
        {suggestions.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => onPick(suggestion)}
                className="rounded-full border border-border px-3 py-1.5 text-xs hover:bg-surface-2"
              >
                {suggestion}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    )
  }

  return <div className="grid gap-3 sm:grid-cols-3">{cards}</div>
}

type CardProps = {
  icon: LucideIcon
  tone: Tone
  title: string
  detail: string
  action: string
} & ({ onClick: () => void; href?: never } | { href: string; onClick?: never })

function TodayCard({ icon: Icon, tone, title, detail, action, onClick, href }: CardProps) {
  const body = (
    <>
      <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg', TONES[tone])}>
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold">{title}</span>
        {detail ? (
          <span className="line-clamp-2 text-xs text-muted-foreground">{detail}</span>
        ) : null}
      </span>
      <span className="mt-auto flex items-center gap-1 text-xs font-medium text-primary">
        {action}
        <ArrowRight className="h-3 w-3" aria-hidden />
      </span>
    </>
  )
  const className =
    'flex min-h-32 flex-col items-start gap-2 rounded-2xl border border-border bg-surface p-4 text-left shadow-sm transition-colors hover:border-ring hover:bg-surface-2'
  return href ? (
    <Link href={href} className={className}>
      {body}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={className}>
      {body}
    </button>
  )
}

function RecentConversations({
  onOpen,
  onShowHistory,
}: {
  onOpen: Props['onOpen']
  onShowHistory: () => void
}) {
  const t = useTranslations('dashboard.assistant.chat.welcome.recent')
  const format = useFormatter()
  const [items, setItems] = useState<Recent[] | null>(null)
  const [loadedAt, setLoadedAt] = useState(() => new Date())
  const [failed, setFailed] = useState(false)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    let live = true
    listAiConversations()
      .then((rows) => {
        if (!live) return
        setLoadedAt(new Date())
        setItems(rows.slice(0, RECENT_COUNT))
      })
      .catch(() => {
        if (live) setItems([])
      })
    return () => {
      live = false
    }
  }, [])

  if (!items || items.length === 0) return null

  const open = (id: string) =>
    startTransition(async () => {
      const result = await loadAiConversation(id)
      if (result === 'notFound') {
        setFailed(true)
        return
      }
      onOpen(result)
    })

  return (
    <section aria-labelledby="assistant-recent" className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3
          id="assistant-recent"
          className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          {t('title')}
        </h3>
        <button
          type="button"
          onClick={onShowHistory}
          className="text-xs font-medium text-primary hover:underline"
        >
          {t('all')}
        </button>
      </div>
      {failed ? (
        <p className="text-sm text-danger" role="alert">
          {t('loadError')}
        </p>
      ) : null}
      <ul className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-surface">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              disabled={pending}
              onClick={() => open(item.id)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2 disabled:opacity-60"
            >
              <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-sm">{item.title}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {format.relativeTime(new Date(item.updatedAt), loadedAt)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
