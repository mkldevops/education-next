'use client'

import { useChat } from '@ai-sdk/react'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@peaklab/ui'
import { DefaultChatTransport, type FileUIPart } from 'ai'
import { CheckCircle2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useState, useTransition } from 'react'
import { Link } from '@/i18n/routing'
import { toast, toastActionError } from '@/lib/toast'
import { enrollmentProposalSchema, PROPOSE_ENROLLMENT_TOOL } from '@/use-cases/ai-assistant/schemas'
import {
  type AssistantConfirmResult,
  confirmAssistantEnrollmentAction,
  previewAssistantEnrollmentAction,
} from '../../../_lib/enroll-assistant-actions'
import {
  emptyProposalForm,
  formFingerprint,
  formToPreviewInput,
  type ProposalForm as ProposalFormState,
  proposalToForm,
} from '../_lib/proposal-form-state'
import { ChatPanel } from './chat-panel'
import { PreviewCard, type PreviewOutcome } from './preview-card'
import { ProposalForm } from './proposal-form'

const transport = new DefaultChatTransport({ api: '/api/ai/enroll-assistant' })

type Committed = Extract<AssistantConfirmResult, { status: 'committed' }>

/**
 * Le code d'erreur voyage soit dans le corps JSON d'un refus (`{ error }`), soit comme
 * texte d'un chunk d'erreur du flux ; dans les deux cas le message ne contient qu'un code.
 */
function errorCode(error: Error): string {
  try {
    const parsed: unknown = JSON.parse(error.message)
    if (typeof parsed === 'object' && parsed !== null && 'error' in parsed) {
      const code = (parsed as { error: unknown }).error
      if (typeof code === 'string') return code
    }
  } catch {
    // message brut
  }
  return error.message
}

/**
 * Dernière proposition complète du modèle : le formulaire suit le tour le plus récent,
 * et une proposition en cours de flux n'est pas encore lue.
 */
function latestProposal(messages: ReturnType<typeof useChat>['messages']) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i]
    if (message.role !== 'assistant') continue
    for (let j = message.parts.length - 1; j >= 0; j--) {
      const part = message.parts[j]
      if (part.type !== `tool-${PROPOSE_ENROLLMENT_TOOL}`) continue
      if (!('state' in part) || part.state !== 'output-available') continue
      return { toolCallId: part.toolCallId, input: part.input }
    }
  }
  return null
}

type Props = {
  schoolName: string
  paymentsEnabled: boolean
  model: string
}

export function EnrollAssistant({ schoolName, paymentsEnabled, model }: Props) {
  const t = useTranslations('dashboard.pages.enrollAssistant')
  const tProposal = useTranslations('dashboard.pages.enrollAssistant.proposal')
  const tConfirm = useTranslations('dashboard.pages.enrollAssistant.confirm')

  const { messages, sendMessage, status, error, clearError, stop, setMessages } = useChat({
    transport,
  })

  const [form, setForm] = useState<ProposalFormState>(emptyProposalForm)
  const [appliedToolCallId, setAppliedToolCallId] = useState<string | null>(null)
  const [invalidFields, setInvalidFields] = useState<string[]>([])
  const [preview, setPreview] = useState<{ outcome: PreviewOutcome; fingerprint: string } | null>(
    null
  )
  const [committed, setCommitted] = useState<Committed | null>(null)
  const [previewPending, startPreview] = useTransition()
  const [confirming, startConfirm] = useTransition()

  const proposal = latestProposal(messages)

  // Une nouvelle proposition remplace le formulaire et invalide l'aperçu : ce que le
  // modèle vient de lire n'a pas été vu par l'humain, encore moins prévisualisé.
  useEffect(() => {
    if (!proposal || proposal.toolCallId === appliedToolCallId) return
    setAppliedToolCallId(proposal.toolCallId)

    const parsed = enrollmentProposalSchema.safeParse(proposal.input)
    if (!parsed.success) {
      toast.error(t('chat.errors.invalidModelOutput'))
      return
    }
    setForm(proposalToForm(parsed.data))
    setPreview(null)
    setInvalidFields([])
    setCommitted(null)
  }, [proposal, appliedToolCallId, t])

  const chatError = error
    ? (() => {
        const code = errorCode(error)
        return t.has(`chat.errors.${code}`) ? t(`chat.errors.${code}`) : t('chat.errors.error')
      })()
    : null

  const edited = preview !== null && preview.fingerprint !== formFingerprint(form, paymentsEnabled)

  const handleSend = (text: string, files: FileUIPart[]) => {
    clearError()
    void sendMessage({ text, files })
  }

  const resetAll = () => {
    stop()
    setMessages([])
    clearError()
    setForm(emptyProposalForm())
    setAppliedToolCallId(null)
    setInvalidFields([])
    setPreview(null)
    setCommitted(null)
  }

  const handleFormChange = (next: ProposalFormState) => {
    setForm(next)
    setInvalidFields([])
  }

  const requestPreview = () => {
    startPreview(async () => {
      const fingerprint = formFingerprint(form, paymentsEnabled)
      try {
        const result = await previewAssistantEnrollmentAction(
          formToPreviewInput(form, paymentsEnabled)
        )
        if (result.status === 'validationError') {
          setInvalidFields(result.fields)
          setPreview(null)
          toast.error(tProposal('errors.validationError', { fields: result.fields.join(', ') }))
          return
        }
        if (result.status === 'aiAssistantDisabled') {
          setPreview(null)
          toast.error(tProposal('errors.aiAssistantDisabled'))
          return
        }
        setInvalidFields([])
        setPreview({ outcome: result, fingerprint })
      } catch {
        toast.error(tProposal('errors.error'))
      }
    })
  }

  const confirm = () => {
    if (preview?.outcome.status !== 'preview' || edited) return
    const { draftId, checksum } = preview.outcome
    startConfirm(async () => {
      try {
        const result = await confirmAssistantEnrollmentAction({ draftId, checksum })
        if (result.status === 'committed') {
          setCommitted(result)
          setPreview(null)
          toast.success(tConfirm('success'))
          return
        }
        // Tout refus rend l'aperçu caduc : le brouillon a expiré, changé ou est verrouillé,
        // et la seule issue est un nouvel aperçu sur des données fraîches.
        setPreview(null)
        toastActionError(tConfirm, result.status === 'refused' ? result.reason : result.status)
      } catch {
        toast.error(tConfirm('errors.error'))
      }
    })
  }

  const useFamily = (family: { id: string; name: string }) => {
    setForm({ ...form, family })
    setInvalidFields([])
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">{t('school', { name: schoolName })}</p>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('chat.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ChatPanel
              messages={messages}
              status={status}
              errorMessage={chatError}
              providerNotice={t('providerNotice', { model })}
              onSend={handleSend}
              onStop={stop}
              onReset={resetAll}
            />
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          {committed ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-success" aria-hidden />
                  {tConfirm('success')}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <p className="text-sm text-muted-foreground">
                  {tConfirm('successDetail', {
                    students: committed.studentIds.length,
                    payments: committed.paymentIds.length,
                  })}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={resetAll}>
                    {tConfirm('newEnrollment')}
                  </Button>
                  <Link
                    href={`/dashboard/families/${committed.familyId}`}
                    className="inline-flex h-10 items-center rounded bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
                  >
                    {tConfirm('openFamily')}
                  </Link>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>{tProposal('title')}</CardTitle>
                </CardHeader>
                <CardContent>
                  {appliedToolCallId === null && messages.length === 0 ? (
                    <p className="mb-4 text-sm text-muted-foreground">{tProposal('empty')}</p>
                  ) : null}
                  <ProposalForm
                    form={form}
                    onChange={handleFormChange}
                    paymentsEnabled={paymentsEnabled}
                    invalidFields={invalidFields}
                    edited={edited}
                    disabled={confirming}
                    previewPending={previewPending}
                    onRequestPreview={requestPreview}
                  />
                </CardContent>
              </Card>

              {preview ? (
                <Card>
                  <CardHeader>
                    <CardTitle>{t('preview.title')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <PreviewCard
                      outcome={preview.outcome}
                      edited={edited}
                      confirming={confirming}
                      onUseFamily={useFamily}
                      onConfirm={confirm}
                    />
                  </CardContent>
                </Card>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
