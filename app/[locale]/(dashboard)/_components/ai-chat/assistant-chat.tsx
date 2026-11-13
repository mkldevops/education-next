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
import { ArrowLeft, History } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from '@/i18n/routing'
import { cn } from '@/lib/utils'
import { chatErrorCode } from './chat-error'
import { ChatPanel, type ChatPartRenderer } from './chat-panel'
import { ConversationHistory } from './conversation-history'
import { draftIdOf, draftPlans } from './draft-plans'
import { type ChatFamily, FamilyPicker } from './family-picker'
import { ToolPart } from './tool-part'
import { endedWithoutAnswer } from './unfinished-turn'

const CHAT_NAMESPACE = 'dashboard.assistant.chat'

type Props = {
  model: string
  className?: string
  listClassName?: string
}

type Session = { id: string; messages: UIMessage[] }

const newSession = (): Session => ({ id: crypto.randomUUID(), messages: [] })

/**
 * Assistant général, partagé par le panneau flottant et la page dédiée : la conversation
 * en cours et l'historique des conversations enregistrées.
 *
 * La conversation reste montée pendant qu'on parcourt l'historique, pour ne pas couper
 * une réponse en cours ; en ouvrir une autre la remplace par une nouvelle instance.
 */
export function AssistantChat({ model, className, listClassName }: Props) {
  const t = useTranslations('dashboard.assistant.history')
  const [session, setSession] = useState(newSession)
  const [showHistory, setShowHistory] = useState(false)

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex shrink-0 justify-end">
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
          onOpen={(conversation) => {
            setSession(conversation)
            setShowHistory(false)
          }}
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
          onNew={() => setSession(newSession())}
        />
      </div>
    </div>
  )
}

type SessionProps = {
  session: Session
  model: string
  listClassName?: string
  onNew: () => void
}

/**
 * Une conversation. La page courante accompagne chaque tour comme simple indice de
 * contexte ; le serveur la filtre et n'en tire aucun droit.
 */
function ChatSession({ session, model, listClassName, onNew }: SessionProps) {
  const t = useTranslations('dashboard.assistant')
  const pathname = usePathname()
  const router = useRouter()
  const pageRef = useRef(pathname)
  const [family, setFamily] = useState<ChatFamily | null>(null)
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

  const chatError = error
    ? (() => {
        const code = chatErrorCode(error)
        return t.has(`chat.errors.${code}`) ? t(`chat.errors.${code}`) : t('chat.errors.error')
      })()
    : status === 'ready' && endedWithoutAnswer(messages)
      ? t('chat.errors.unfinished')
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

  const reset = () => {
    void stop()
    onNew()
  }

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
      suggestions={t.raw('chat.suggestions') as string[]}
      composerTools={
        <FamilyPicker
          value={family}
          onChange={setFamily}
          disabled={status === 'submitted' || status === 'streaming'}
        />
      }
      onSend={handleSend}
      onStop={stop}
      onReset={reset}
    />
  )
}
