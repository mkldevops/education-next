'use client'

import { useChat } from '@ai-sdk/react'
import { Button } from '@peaklab/ui'
import {
  DefaultChatTransport,
  type FileUIPart,
  isToolUIPart,
  lastAssistantMessageIsCompleteWithApprovalResponses,
  type UIMessage,
} from 'ai'
import { ArrowLeft, History, Loader2, SquarePen } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from '@/i18n/routing'
import { cn } from '@/lib/utils'
import type { AssistantBriefing } from '@/use-cases/ai-assistant/assistant-briefing'
import { AssistantWelcome } from './assistant-welcome'
import { chatErrorCode } from './chat-error'
import { ChatPanel, type ChatPartRenderer } from './chat-panel'
import { compactOffer, compactRequest, compactSeed, compactTitle } from './compact-conversation'
import { ConversationHistory } from './conversation-history'
import { draftIdOf, draftPlans } from './draft-plans'
import { type ChatFamily, FamilyPicker } from './family-picker'
import { ToolPart } from './tool-part'
import { endedTruncated, endedWithoutAnswer } from './unfinished-turn'

const CHAT_NAMESPACE = 'dashboard.assistant.chat'

type Props = {
  model: string
  className?: string
  listClassName?: string
  /** Page dédiée seulement : l'accueil « À traiter aujourd'hui » remplace l'invite vide. */
  welcome?: { briefing: Promise<AssistantBriefing>; currency: string }
}

/** `family` et `draft` passent d'une conversation chargée à sa suite résumée. */
type Session = { id: string; messages: UIMessage[]; family?: ChatFamily | null; draft?: string }

const newSession = (): Session => ({ id: crypto.randomUUID(), messages: [] })

/**
 * Assistant général, partagé par le panneau flottant et la page dédiée : la conversation
 * en cours et l'historique des conversations enregistrées.
 *
 * La conversation reste montée pendant qu'on parcourt l'historique, pour ne pas couper
 * une réponse en cours ; en ouvrir une autre la remplace par une nouvelle instance.
 */
export function AssistantChat({ model, className, listClassName, welcome }: Props) {
  const t = useTranslations('dashboard.assistant.history')
  const [session, setSession] = useState(newSession)
  const [showHistory, setShowHistory] = useState(false)
  const stopRef = useRef<() => Promise<void>>(async () => {})

  const startNew = () => {
    void stopRef.current()
    setSession(newSession())
    setShowHistory(false)
  }

  const openConversation = (conversation: Session) => {
    setSession(conversation)
    setShowHistory(false)
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex shrink-0 justify-between gap-2">
        <Button type="button" variant="outline" size="sm" onClick={startNew}>
          <SquarePen className="h-4 w-4" aria-hidden />
          {t('new')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowHistory((current) => !current)}
          aria-expanded={showHistory}
        >
          {showHistory ? (
            <ArrowLeft className="h-4 w-4" aria-hidden />
          ) : (
            <History className="h-4 w-4" aria-hidden />
          )}
          {showHistory ? t('back') : t('show')}
        </Button>
      </div>
      {showHistory ? (
        <ConversationHistory
          activeId={session.id}
          onOpen={openConversation}
          onDeleted={(id) => {
            if (id === session.id) setSession(newSession())
          }}
        />
      ) : null}
      <div hidden={showHistory} className="flex min-h-0 flex-1 flex-col">
        <ChatSession
          key={session.id}
          session={session}
          model={model}
          listClassName={listClassName}
          stopRef={stopRef}
          onContinue={setSession}
          welcome={
            welcome
              ? { ...welcome, onOpen: openConversation, onShowHistory: () => setShowHistory(true) }
              : undefined
          }
        />
      </div>
    </div>
  )
}

type SessionProps = {
  session: Session
  model: string
  listClassName?: string
  stopRef: { current: () => Promise<void> }
  onContinue: (next: Session) => void
  welcome?: NonNullable<Props['welcome']> & {
    onOpen: (conversation: Session) => void
    onShowHistory: () => void
  }
}

/**
 * Une conversation. La page courante accompagne chaque tour comme simple indice de
 * contexte ; le serveur la filtre et n'en tire aucun droit.
 */
function ChatSession({
  session,
  model,
  listClassName,
  stopRef,
  onContinue,
  welcome,
}: SessionProps) {
  const t = useTranslations('dashboard.assistant')
  const pathname = usePathname()
  const router = useRouter()
  const pageRef = useRef(pathname)
  const [family, setFamily] = useState<ChatFamily | null>(session.family ?? null)
  const familyRef = useRef(family)

  useEffect(() => {
    pageRef.current = pathname
  }, [pathname])

  useEffect(() => {
    familyRef.current = family
  }, [family])

  const [transport] = useState(
    () =>
      new DefaultChatTransport({
        api: '/api/ai/assistant',
        body: () => ({ page: pageRef.current, familyId: familyRef.current?.id }),
      })
  )

  const { messages, sendMessage, status, error, clearError, stop, addToolApprovalResponse } =
    useChat({
      id: session.id,
      messages: session.messages,
      transport,
      sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
      // Une écriture validée change les données affichées autour de la conversation.
      onFinish: ({ message }) => {
        const wrote = message.parts.some(
          (part) =>
            isToolUIPart(part) && part.state === 'output-available' && part.approval?.approved
        )
        if (wrote) router.refresh()
      },
    })

  const errorCode = error ? chatErrorCode(error) : null
  const chatError = errorCode
    ? t.has(`chat.errors.${errorCode}`)
      ? t(`chat.errors.${errorCode}`)
      : t('chat.errors.error')
    : status === 'ready' && endedWithoutAnswer(messages)
      ? t('chat.errors.unfinished')
      : status === 'ready' && endedTruncated(messages)
        ? t('chat.errors.truncated')
        : null

  const plans = draftPlans(messages)
  const renderToolPart: ChatPartRenderer = (part, key) =>
    isToolUIPart(part) ? (
      <ToolPart
        key={key}
        part={part}
        plan={plans.get(draftIdOf(part.input) ?? '')}
        onApproval={(response) => {
          clearError()
          void addToolApprovalResponse(response)
        }}
      />
    ) : null

  const handleSend = (text: string, files: FileUIPart[]) => {
    clearError()
    void sendMessage({ text, files })
  }

  useEffect(() => {
    stopRef.current = stop
  }, [stopRef, stop])

  const [compacting, setCompacting] = useState<'idle' | 'working' | 'failed'>('idle')
  const offer = status === 'ready' || status === 'error' ? compactOffer(messages, errorCode) : null

  // Le résumé peut prendre une minute : il ne remplace la conversation que si elle est
  // toujours affichée et n'a pas bougé depuis le clic.
  const compactAbort = useRef<AbortController | null>(null)
  const messagesRef = useRef(messages)
  useEffect(() => {
    messagesRef.current = messages
  }, [messages])
  useEffect(() => () => compactAbort.current?.abort(), [])

  const continueSummarized = async () => {
    const controller = new AbortController()
    compactAbort.current = controller
    const snapshot = messages
    const stale = () => controller.signal.aborted || messagesRef.current !== snapshot
    setCompacting('working')
    const { draft, messages: history } = compactRequest(snapshot)
    try {
      const response = await fetch('/api/ai/assistant/summary', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: history }),
        signal: controller.signal,
      })
      const body: unknown = await response.json().catch(() => null)
      if (stale()) {
        setCompacting('idle')
        return
      }
      const summary =
        response.ok && typeof body === 'object' && body !== null && 'summary' in body
          ? body.summary
          : null
      if (typeof summary !== 'string' || !summary) {
        setCompacting('failed')
        return
      }
      const title = compactTitle(snapshot) || t('chat.compact.untitled')
      onContinue({
        id: crypto.randomUUID(),
        messages: compactSeed(
          t('chat.compact.seedQuestion', { title }),
          t('chat.compact.seedHeading'),
          summary
        ),
        family,
        draft,
      })
    } catch {
      setCompacting(stale() ? 'idle' : 'failed')
    }
  }

  const notice = offer ? (
    <div
      className="flex flex-col gap-2 rounded-2xl border border-warning/30 bg-warning-subtle p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
      role="status"
    >
      <p>
        {compacting === 'failed'
          ? t('chat.compact.failed')
          : offer === 'blocked'
            ? t('chat.compact.blocked')
            : t('chat.compact.heavy')}
      </p>
      <Button
        type="button"
        size="sm"
        className="shrink-0"
        disabled={compacting === 'working'}
        onClick={() => void continueSummarized()}
      >
        {compacting === 'working' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
        {compacting === 'working' ? t('chat.compact.working') : t('chat.compact.action')}
      </Button>
    </div>
  ) : null

  const suggestions = t.raw('chat.suggestions') as string[]

  return (
    <ChatPanel
      namespace={CHAT_NAMESPACE}
      renderPart={renderToolPart}
      className="min-h-0 flex-1"
      listClassName={listClassName}
      messages={messages}
      status={status}
      errorMessage={chatError}
      providerNotice={t('providerNotice', { model })}
      suggestions={suggestions}
      welcome={
        welcome
          ? ({ composer, pick }) => (
              <AssistantWelcome
                briefing={welcome.briefing}
                currency={welcome.currency}
                composer={composer}
                suggestions={suggestions}
                onPick={pick}
                onOpen={welcome.onOpen}
                onShowHistory={welcome.onShowHistory}
              />
            )
          : undefined
      }
      notice={notice}
      initialText={session.draft}
      composerTools={
        <FamilyPicker
          value={family}
          onChange={setFamily}
          disabled={status === 'submitted' || status === 'streaming'}
        />
      }
      onSend={handleSend}
      onStop={stop}
    />
  )
}
