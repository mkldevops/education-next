'use client'

import { Button, Textarea } from '@peaklab/ui'
import type { ChatStatus, FileUIPart, UIMessage } from 'ai'
import { ImagePlus, Loader2, Mic, RotateCcw, Send, Square, X } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import {
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react'
import { AI_ASSISTANT_LIMITS, isAiAssistantImageType } from '@/domain/ai-assistant'
import { cn } from '@/lib/utils'
import { useDictation } from './use-dictation'
import { VoiceMeter, voiceRingClass } from './voice-meter'

type Attachment = { name: string; mediaType: string; url: string }

type FileError = 'type' | 'size' | 'count'

const MAX_IMAGE_MB = Math.floor(AI_ASSISTANT_LIMITS.maxImageBytes / (1024 * 1024))

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

/**
 * Filtre côté navigateur, pour épargner un aller-retour : le serveur refait chaque
 * vérification sur les octets reçus, celle-ci n'est qu'un confort.
 */
function firstFileError(files: File[], alreadyAttached: number): FileError | null {
  if (alreadyAttached + files.length > AI_ASSISTANT_LIMITS.maxImagesPerMessage) return 'count'
  for (const file of files) {
    if (!isAiAssistantImageType(file.type)) return 'type'
    if (file.size > AI_ASSISTANT_LIMITS.maxImageBytes) return 'size'
  }
  return null
}

export type ChatPart = UIMessage['parts'][number]

/** Rendu des parties propres à un assistant (outils) ; `null` les masque. */
export type ChatPartRenderer = (part: ChatPart, key: string) => ReactNode

type Props = {
  /** Espace de traduction des libellés : chaque assistant garde ses propres textes. */
  namespace: string
  renderPart?: ChatPartRenderer
  className?: string
  listClassName?: string
  messages: UIMessage[]
  status: ChatStatus
  errorMessage: string | null
  providerNotice: string
  onSend: (text: string, files: FileUIPart[]) => void
  onStop: () => void
  onReset: () => void
}

export function ChatPanel({
  namespace,
  renderPart,
  className,
  listClassName,
  messages,
  status,
  errorMessage,
  providerNotice,
  onSend,
  onStop,
  onReset,
}: Props) {
  const t = useTranslations(namespace)
  const [text, setText] = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [fileError, setFileError] = useState<FileError | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const inputId = useId()
  const listRef = useRef<HTMLDivElement>(null)
  const sectionRef = useRef<HTMLElement>(null)
  const lastMessage = messages.at(-1)
  const locale = useLocale()
  const dictation = useDictation(locale === 'en' ? 'en-US' : 'fr-FR', (spoken) => {
    if (!spoken) return
    setText((current) => (current.trim() ? `${current.trimEnd()} ${spoken}` : spoken))
  })

  // Le fil suit la réponse en cours : un tour d'outils allonge le dernier message.
  useEffect(() => {
    const list = listRef.current
    if (!lastMessage || !list) return
    list.scrollTop = list.scrollHeight
  }, [lastMessage])

  const busy = status === 'submitted' || status === 'streaming'

  // La zone de saisie, désactivée pendant la réponse, perd le focus : il y revient à la fin
  // du tour, sauf si l'administrateur est parti ailleurs dans la page.
  const wasBusy = useRef(busy)
  useEffect(() => {
    const finished = wasBusy.current && !busy
    wasBusy.current = busy
    if (!finished) return
    const active = document.activeElement
    const idle = !active || active === document.body || sectionRef.current?.contains(active)
    if (idle) document.getElementById(inputId)?.focus()
  }, [busy, inputId])
  const canSend = !busy && (text.trim() !== '' || attachments.length > 0)

  const handleFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (files.length === 0) return

    const error = firstFileError(files, attachments.length)
    if (error) {
      setFileError(error)
      return
    }

    const read = await Promise.all(
      files.map(async (file) => ({
        name: file.name,
        mediaType: file.type,
        url: await readAsDataUrl(file),
      }))
    )
    setFileError(null)
    setAttachments((current) => [...current, ...read])
  }

  const submit = () => {
    if (!canSend) return

    dictation.cancel()
    onSend(
      text.trim(),
      attachments.map((attachment) => ({
        type: 'file',
        mediaType: attachment.mediaType,
        filename: attachment.name,
        url: attachment.url,
      }))
    )
    setText('')
    setAttachments([])
    setFileError(null)
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    submit()
  }

  // Entrée envoie, Maj+Entrée va à la ligne ; une composition IME en cours n'envoie rien.
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
    event.preventDefault()
    submit()
  }

  const handleReset = () => {
    setText('')
    setAttachments([])
    setFileError(null)
    onReset()
  }

  const fileErrorText =
    fileError === 'type'
      ? t('fileErrors.type')
      : fileError === 'size'
        ? t('fileErrors.size', { size: MAX_IMAGE_MB })
        : fileError === 'count'
          ? t('fileErrors.count', { count: AI_ASSISTANT_LIMITS.maxImagesPerMessage })
          : null
  const dictationErrorText = dictation.error ? t(`dictation.errors.${dictation.error}`) : null

  return (
    <section
      ref={sectionRef}
      className={cn('flex flex-col gap-4', className)}
      aria-label={t('title')}
    >
      <p className="rounded border border-border bg-surface-2 px-3 py-2 text-xs text-muted-foreground">
        {providerNotice}
      </p>

      <div
        ref={listRef}
        className={cn(
          'flex max-h-[28rem] min-h-40 flex-col gap-3 overflow-y-auto rounded border border-border bg-surface p-3',
          listClassName
        )}
      >
        {messages.length === 0 ? (
          <p className="m-auto text-sm text-muted-foreground">{t('empty')}</p>
        ) : (
          messages.map((message) => (
            <ChatMessage
              key={message.id}
              message={message}
              namespace={namespace}
              renderPart={renderPart}
            />
          ))
        )}
        {busy ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {t('thinking')}
          </p>
        ) : null}
        {errorMessage ? (
          <p className="text-sm text-danger" role="alert">
            {errorMessage}
          </p>
        ) : null}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <label htmlFor={inputId} className="sr-only">
          {t('placeholder')}
        </label>
        <Textarea
          id={inputId}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('placeholder')}
          rows={3}
          maxLength={AI_ASSISTANT_LIMITS.maxTextChars}
          disabled={busy}
          className={dictation.listening ? `border-primary ${voiceRingClass}` : undefined}
        />
        {dictation.listening ? (
          <p className="min-h-5 truncate text-sm italic text-muted-foreground" aria-live="polite">
            {dictation.interim ? `${dictation.interim}…` : t('dictation.listening')}
          </p>
        ) : null}

        {attachments.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {attachments.map((attachment, index) => (
              <li key={attachment.url} className="relative">
                {/* biome-ignore lint/performance/noImgElement: aperçu local d'une data URL, jamais servie par le site */}
                <img
                  src={attachment.url}
                  alt={t('imageAlt', { index: index + 1 })}
                  className="h-16 w-16 rounded border border-border object-cover"
                />
                <button
                  type="button"
                  onClick={() => setAttachments((current) => current.filter((_, i) => i !== index))}
                  className="absolute -right-2 -top-2 rounded-full border border-border bg-surface p-0.5"
                  aria-label={t('removeImage')}
                >
                  <X className="h-3 w-3" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {fileErrorText ? (
          <p className="text-sm text-danger" role="alert">
            {fileErrorText}
          </p>
        ) : null}
        {dictationErrorText ? (
          <p className="text-sm text-danger" role="alert">
            {dictationErrorText}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            onChange={handleFiles}
            className="hidden"
            aria-label={t('attach')}
            disabled={busy}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
          >
            <ImagePlus className="h-4 w-4" aria-hidden />
            {t('attach')}
          </Button>
          {dictation.supported ? (
            <Button
              type="button"
              variant={dictation.listening ? 'secondary' : 'outline'}
              size="sm"
              onClick={dictation.listening ? dictation.stop : dictation.start}
              disabled={busy}
              aria-pressed={dictation.listening}
              title={t('dictation.hint')}
            >
              {dictation.listening ? <VoiceMeter /> : <Mic className="h-4 w-4" aria-hidden />}
              {dictation.listening ? t('dictation.stop') : t('dictation.start')}
            </Button>
          ) : null}
          <span className="text-xs text-muted-foreground">
            {t('attachHint', {
              count: AI_ASSISTANT_LIMITS.maxImagesPerMessage,
              size: MAX_IMAGE_MB,
            })}
          </span>
          <span className="grow" />
          {messages.length > 0 ? (
            <Button type="button" variant="ghost" size="sm" onClick={handleReset} disabled={busy}>
              <RotateCcw className="h-4 w-4" aria-hidden />
              {t('reset')}
            </Button>
          ) : null}
          {busy ? (
            <Button type="button" variant="secondary" size="sm" onClick={onStop}>
              <Square className="h-4 w-4" aria-hidden />
              {t('stop')}
            </Button>
          ) : (
            <Button type="submit" size="sm" disabled={!canSend}>
              <Send className="h-4 w-4" aria-hidden />
              {t('send')}
            </Button>
          )}
        </div>
      </form>
    </section>
  )
}

function ChatMessage({
  message,
  namespace,
  renderPart,
}: {
  message: UIMessage
  namespace: string
  renderPart?: ChatPartRenderer
}) {
  const t = useTranslations(namespace)
  const mine = message.role === 'user'

  return (
    <article
      className={
        mine
          ? 'ml-auto max-w-[85%] rounded-lg bg-primary-subtle px-3 py-2 text-sm'
          : 'mr-auto max-w-[85%] rounded-lg bg-surface-2 px-3 py-2 text-sm'
      }
    >
      <p className="mb-1 text-xs font-medium text-muted-foreground">
        {mine ? t('you') : t('assistant')}
      </p>
      {message.parts.map((part, index) => {
        const key = `${message.id}-${index}`
        if (part.type === 'text') {
          return (
            <p key={key} className="whitespace-pre-wrap">
              {part.text}
            </p>
          )
        }
        if (part.type === 'file') {
          return (
            // biome-ignore lint/performance/noImgElement: data URL locale, jamais servie par le site
            <img
              key={key}
              src={part.url}
              alt={t('imageAlt', { index: index + 1 })}
              className="mt-1 h-24 w-24 rounded border border-border object-cover"
            />
          )
        }
        return renderPart ? renderPart(part, key) : null
      })}
    </article>
  )
}
