'use client'

import {
  Button,
  Message,
  MessageContent,
  MessageHeader,
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
  Textarea,
} from '@peaklab/ui'
import type { ChatStatus, FileUIPart, UIMessage } from 'ai'
import { ArrowUp, FileText, Loader2, Mic, Paperclip, Square, SquarePen, X } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import {
  type ChangeEvent,
  type ClipboardEvent,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react'
import {
  AI_ASSISTANT_LIMITS,
  AI_ASSISTANT_PDF_TYPE,
  isAiAssistantAttachmentType,
} from '@/domain/ai-assistant'
import { cn } from '@/lib/utils'
import { MessageText } from './message-text'
import { useDictation } from './use-dictation'
import { VoiceMeter, voiceRingClass } from './voice-meter'

type Attachment = { name: string; mediaType: string; url: string }

type FileError = 'type' | 'size' | 'count'

const MAX_IMAGE_MB = Math.floor(AI_ASSISTANT_LIMITS.maxImageBytes / (1024 * 1024))

const ACCEPTED_FILES = `image/png,image/jpeg,image/webp,${AI_ASSISTANT_PDF_TYPE}`

/** Une capture collée arrive sans nom parlant (« image.png ») : on la date. */
function attachmentName(file: File) {
  if (file.name && file.name !== 'image.png') return file.name
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  return `capture-${stamp}.${file.type.split('/')[1] ?? 'png'}`
}

const hasFiles = (event: DragEvent) => Array.from(event.dataTransfer.types).includes('Files')

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
    if (!isAiAssistantAttachmentType(file.type)) return 'type'
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
  /** Contrôles propres à l'assistant, placés dans la barre du champ de saisie. */
  composerTools?: ReactNode
  /** Amorces proposées sur une conversation vide ; un clic les place dans le champ. */
  suggestions?: string[]
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
  composerTools,
  suggestions = [],
  onSend,
  onStop,
  onReset,
}: Props) {
  const t = useTranslations(namespace)
  const [text, setText] = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [fileError, setFileError] = useState<FileError | null>(null)
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const inputId = useId()
  const sectionRef = useRef<HTMLElement>(null)
  const locale = useLocale()
  const dictation = useDictation(locale === 'en' ? 'en-US' : 'fr-FR', (spoken) => {
    if (!spoken) return
    setText((current) => (current.trim() ? `${current.trimEnd()} ${spoken}` : spoken))
  })

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

  const addFiles = async (files: File[]) => {
    if (files.length === 0 || busy) return

    const error = firstFileError(files, attachments.length)
    if (error) {
      setFileError(error)
      return
    }

    const read = await Promise.all(
      files.map(async (file) => ({
        name: attachmentName(file),
        mediaType: file.type,
        url: await readAsDataUrl(file),
      }))
    )
    setFileError(null)
    setAttachments((current) => [...current, ...read])
  }

  const handleFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    void addFiles(files)
  }

  // Une capture d'écran collée devient une pièce jointe ; un texte collé reste du texte.
  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(event.clipboardData.files)
    if (files.length === 0) return
    event.preventDefault()
    void addFiles(files)
  }

  const handleDragOver = (event: DragEvent) => {
    if (busy || !hasFiles(event)) return
    event.preventDefault()
    setDragging(true)
  }

  const handleDragLeave = (event: DragEvent) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false)
  }

  const handleDrop = (event: DragEvent) => {
    if (!hasFiles(event)) return
    event.preventDefault()
    setDragging(false)
    void addFiles(Array.from(event.dataTransfer.files))
  }

  const pickSuggestion = (suggestion: string) => {
    setText(suggestion)
    document.getElementById(inputId)?.focus()
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
      className={cn('relative flex flex-col gap-3', className)}
      aria-label={t('title')}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {dragging ? (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center rounded-2xl border-2 border-dashed border-primary bg-background/85 text-sm font-medium text-primary">
          <Paperclip className="mr-2 h-4 w-4" aria-hidden />
          {t('dropHere')}
        </div>
      ) : null}

      <MessageScrollerProvider autoScroll defaultScrollPosition="end">
        <MessageScroller className={cn('h-auto max-h-112 min-h-40', listClassName)}>
          <MessageScrollerViewport aria-label={t('title')}>
            <MessageScrollerContent className="gap-5 px-1 py-3">
              {messages.length === 0 ? (
                <div className="m-auto flex max-w-md flex-col items-center gap-4 text-center">
                  <p className="text-lg font-semibold">{t('emptyTitle')}</p>
                  <p className="text-sm text-muted-foreground">{t('empty')}</p>
                  {suggestions.length > 0 ? (
                    <div className="flex flex-wrap justify-center gap-2">
                      {suggestions.map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => pickSuggestion(suggestion)}
                          className="rounded-full border border-border px-3 py-1.5 text-xs hover:bg-surface-2"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                messages.map((message) => (
                  <MessageScrollerItem
                    key={message.id}
                    messageId={message.id}
                    scrollAnchor={message.role === 'user'}
                  >
                    <ChatMessage message={message} namespace={namespace} renderPart={renderPart} />
                  </MessageScrollerItem>
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
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton aria-label={t('scrollToEnd')} title={t('scrollToEnd')} />
        </MessageScroller>
      </MessageScrollerProvider>

      <form
        onSubmit={handleSubmit}
        className={cn(
          'flex flex-col gap-1 rounded-3xl border border-border bg-surface p-2 shadow-sm transition-colors',
          'focus-within:border-ring',
          dictation.listening && `border-primary ${voiceRingClass}`
        )}
      >
        {attachments.length > 0 ? (
          <ul className="flex flex-wrap gap-2 px-1 pt-1">
            {attachments.map((attachment, index) => (
              <li key={attachment.url} className="relative">
                {attachment.mediaType === AI_ASSISTANT_PDF_TYPE ? (
                  <FileChip name={attachment.name} />
                ) : (
                  // biome-ignore lint/performance/noImgElement: aperçu local d'une data URL, jamais servie par le site
                  <img
                    src={attachment.url}
                    alt={t('imageAlt', { index: index + 1 })}
                    className="h-16 w-16 rounded-xl border border-border object-cover"
                  />
                )}
                <button
                  type="button"
                  onClick={() => setAttachments((current) => current.filter((_, i) => i !== index))}
                  className="absolute -right-1.5 -top-1.5 rounded-full border border-border bg-surface p-0.5 shadow-sm"
                  aria-label={t('removeImage')}
                >
                  <X className="h-3 w-3" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <label htmlFor={inputId} className="sr-only">
          {t('placeholder')}
        </label>
        <Textarea
          id={inputId}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={t('placeholder')}
          rows={1}
          maxLength={AI_ASSISTANT_LIMITS.maxTextChars}
          disabled={busy}
          className="field-sizing-content max-h-48 min-h-11 resize-none border-0 bg-transparent px-2 text-base focus:ring-0 sm:text-sm"
        />
        {dictation.listening ? (
          <p
            className="min-h-5 truncate px-2 text-sm italic text-muted-foreground"
            aria-live="polite"
          >
            {dictation.interim ? `${dictation.interim}…` : t('dictation.listening')}
          </p>
        ) : null}

        <div className="flex items-center gap-1">
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_FILES}
            multiple
            onChange={handleFiles}
            className="hidden"
            aria-label={t('attach')}
            disabled={busy}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            aria-label={t('attach')}
            title={t('attachHint', {
              count: AI_ASSISTANT_LIMITS.maxImagesPerMessage,
              size: MAX_IMAGE_MB,
            })}
          >
            <Paperclip className="h-4 w-4" aria-hidden />
          </Button>
          {composerTools}
          <span className="grow" />
          {messages.length > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full"
              onClick={handleReset}
              disabled={busy}
              aria-label={t('reset')}
              title={t('reset')}
            >
              <SquarePen className="h-4 w-4" aria-hidden />
            </Button>
          ) : null}
          {dictation.supported ? (
            <Button
              type="button"
              variant={dictation.listening ? 'secondary' : 'ghost'}
              size="icon"
              className="h-8 w-8 rounded-full"
              onClick={dictation.listening ? dictation.stop : dictation.start}
              disabled={busy}
              aria-pressed={dictation.listening}
              aria-label={dictation.listening ? t('dictation.stop') : t('dictation.start')}
              title={t('dictation.hint')}
            >
              {dictation.listening ? <VoiceMeter /> : <Mic className="h-4 w-4" aria-hidden />}
            </Button>
          ) : null}
          {busy ? (
            <Button
              type="button"
              size="icon"
              className="h-8 w-8 rounded-full"
              onClick={onStop}
              aria-label={t('stop')}
              title={t('stop')}
            >
              <Square className="h-3.5 w-3.5 fill-current" aria-hidden />
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon"
              className="h-8 w-8 rounded-full"
              disabled={!canSend}
              aria-label={t('send')}
              title={t('send')}
            >
              <ArrowUp className="h-4 w-4" aria-hidden />
            </Button>
          )}
        </div>
      </form>

      {fileErrorText ? (
        <p className="px-2 text-sm text-danger" role="alert">
          {fileErrorText}
        </p>
      ) : null}
      {dictationErrorText ? (
        <p className="px-2 text-sm text-danger" role="alert">
          {dictationErrorText}
        </p>
      ) : null}

      <p className="text-center text-xs text-muted-foreground">{providerNotice}</p>
    </section>
  )
}

function FileChip({ name }: { name: string }) {
  return (
    <span className="flex h-16 max-w-56 items-center gap-2 rounded-xl border border-border bg-surface-2 px-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-danger text-white">
        <FileText className="h-4 w-4" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium" title={name}>
          {name}
        </span>
        <span className="block text-xs text-muted-foreground">PDF</span>
      </span>
    </span>
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

  const files = message.parts.filter((part) => part.type === 'file')
  const hasBody = message.parts.some((part) => part.type !== 'file')

  return (
    <Message align={mine ? 'end' : 'start'}>
      <MessageContent
        className={cn(
          'gap-1.5 group-data-[align=end]/message:items-end',
          mine ? 'max-w-[85%]' : 'w-full max-w-full'
        )}
      >
        <MessageHeader className={cn('px-0', mine && 'sr-only')}>
          {mine ? t('you') : t('assistant')}
        </MessageHeader>
        {files.length > 0 ? (
          <div className="flex flex-wrap justify-end gap-2">
            {files.map((part, index) => {
              const key = `${message.id}-f${index}`
              return part.mediaType === AI_ASSISTANT_PDF_TYPE ? (
                <FileChip key={key} name={part.filename ?? 'document.pdf'} />
              ) : (
                // biome-ignore lint/performance/noImgElement: data URL locale, jamais servie par le site
                <img
                  key={key}
                  src={part.url}
                  alt={t('imageAlt', { index: index + 1 })}
                  className="h-32 w-32 rounded-xl border border-border object-cover"
                />
              )
            })}
          </div>
        ) : null}
        <div
          hidden={!hasBody}
          className={cn(
            'w-fit max-w-full text-sm leading-relaxed',
            mine ? 'rounded-3xl bg-surface-2 px-4 py-2' : 'w-full'
          )}
        >
          {message.parts.map((part, index) => {
            const key = `${message.id}-${index}`
            if (part.type === 'text') {
              return <MessageText key={key} text={part.text} />
            }
            if (part.type === 'file') return null
            return renderPart ? renderPart(part, key) : null
          })}
        </div>
      </MessageContent>
    </Message>
  )
}
