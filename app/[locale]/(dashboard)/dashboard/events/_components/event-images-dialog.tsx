'use client'

import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  useDialog,
} from '@peaklab/ui'
import { ImageIcon, ImagePlus, Star, Trash2 } from 'lucide-react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { useId, useRef, useState, useTransition } from 'react'
import { MAX_EVENT_IMAGE_BYTES, MAX_EVENT_IMAGES } from '@/domain/event'
import { toast, toastActionError } from '@/lib/toast'
import {
  removeEventImageAction,
  setEventCoverAction,
  uploadEventImageAction,
} from '../../../_lib/event-actions'

type EventImageRow = {
  id: string
  storageKey: string
  alt: string | null
  position: number
}

type Props = {
  eventId: string
  eventTitle: string
  images: EventImageRow[]
  /** `menuitem` quand le déclencheur est une entrée de menu, pour la navigation au clavier. */
  triggerRole?: React.AriaRole
  /** Cible de repli du focus quand le déclencheur est devenu inaccessible à la fermeture. */
  restoreFocusRef?: React.RefObject<HTMLElement | null>
}

export function EventImagesDialog({
  eventId,
  eventTitle,
  images,
  triggerRole,
  restoreFocusRef,
}: Props) {
  const t = useTranslations('dashboard.pages.events.images')

  return (
    <Dialog restoreFocusRef={restoreFocusRef}>
      <DialogTrigger>
        <Button variant="outline" size="sm" role={triggerRole}>
          <ImageIcon className="h-4 w-4" />
          {t('trigger', { count: images.length })}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('title', { title: eventTitle })}</DialogTitle>
        </DialogHeader>
        <EventImagesManager eventId={eventId} images={images} />
      </DialogContent>
    </Dialog>
  )
}

/**
 * Monté à chaque ouverture (le contenu du dialogue est démonté fermé) : l'état local repart
 * donc des images fraîchement relues par la page après `revalidatePath`.
 */
function EventImagesManager({ eventId, images: initialImages }: Pick<Props, 'eventId' | 'images'>) {
  const t = useTranslations('dashboard.pages.events')
  const tCommon = useTranslations('common')
  const { setOpen } = useDialog()
  const [images, setImages] = useState(initialImages)
  const [isPending, startTransition] = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const altInputRef = useRef<HTMLInputElement>(null)
  const altId = useId()

  const remaining = MAX_EVENT_IMAGES - images.length

  const handleFiles = (fileList: FileList) => {
    // Au-delà de la limite de corps des Server Actions, Next.js coupe la requête avant que
    // l'action ne réponde `fileTooLarge` : un fichier trop lourd n'est donc jamais envoyé.
    const files = Array.from(fileList)
    const sendable = files.filter((file) => file.size <= MAX_EVENT_IMAGE_BYTES)
    const tooLarge = files.length - sendable.length
    if (tooLarge > 0) toast.error(t('images.tooLarge', { count: tooLarge }))
    if (sendable.length > remaining) {
      toast.warning(t('images.tooManySelected', { count: remaining }))
    }
    const accepted = sendable.slice(0, remaining)
    const alt = altInputRef.current?.value ?? ''

    startTransition(async () => {
      // Envoi séquentiel : chaque ajout relit le compteur côté serveur, des envois parallèles
      // pourraient franchir ensemble la limite de six images.
      let added = 0
      for (const file of accepted) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('eventId', eventId)
        formData.append('alt', alt)

        const result = await uploadEventImageAction(formData).catch(() => 'unexpected' as const)
        if (typeof result === 'string') {
          toastActionError(t, result)
          break
        }
        added++
        setImages((prev) => [...prev, result])
      }
      if (added > 0) toast.success(t('success.imageAdded'))
      if (altInputRef.current) altInputRef.current.value = ''
      if (fileInputRef.current) fileInputRef.current.value = ''
    })
  }

  const runOnImages = (
    action: () => Promise<string | EventImageRow[]>,
    successKey: 'success.imageRemoved' | 'success.coverChanged'
  ) => {
    startTransition(async () => {
      const result = await action()
      if (typeof result === 'string') {
        toastActionError(t, result)
        return
      }
      setImages(result)
      toast.success(t(successKey))
    })
  }

  return (
    <>
      <DialogBody>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-graphite-600">{t('images.hint')}</p>
            <p className="text-xs font-medium text-graphite">
              {t('images.counter', { count: images.length, max: MAX_EVENT_IMAGES })}
            </p>
          </div>

          {images.length === 0 ? (
            <p className="rounded border border-dashed border-alabaster-700 p-6 text-center text-sm text-graphite-600">
              {t('images.none')}
            </p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {images.map((image) => {
                const isCover = image.position === 0
                return (
                  <li
                    key={image.id}
                    className={`overflow-hidden rounded border ${
                      isCover ? 'border-primary ring-2 ring-primary-light' : 'border-alabaster-700'
                    }`}
                  >
                    <div className="relative">
                      <Image
                        src={`/api/media/${image.storageKey}`}
                        alt={image.alt ?? ''}
                        width={240}
                        height={160}
                        className="h-28 w-full object-cover"
                      />
                      {isCover && (
                        <span className="absolute left-1 top-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
                          {t('images.cover')}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-1 p-1">
                      {isCover ? (
                        <span />
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          disabled={isPending}
                          onClick={() =>
                            runOnImages(
                              () => setEventCoverAction(eventId, image.id),
                              'success.coverChanged'
                            )
                          }
                        >
                          <Star className="h-3 w-3" />
                          {t('images.setCover')}
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-red-700"
                        disabled={isPending}
                        onClick={() =>
                          runOnImages(
                            () => removeEventImageAction(eventId, image.id),
                            'success.imageRemoved'
                          )
                        }
                        aria-label={t('images.remove')}
                        title={t('images.remove')}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

          {remaining > 0 && (
            <div className="space-y-3 border-t border-alabaster-700 pt-4">
              <div className="space-y-2">
                <Label htmlFor={altId}>{t('fields.alt')}</Label>
                <Input
                  id={altId}
                  ref={altInputRef}
                  type="text"
                  maxLength={250}
                  disabled={isPending}
                />
                <p className="text-xs text-graphite-600">{t('images.altHint')}</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
                disabled={isPending}
                onChange={(e) => {
                  if (e.target.files?.length) handleFiles(e.target.files)
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={() => fileInputRef.current?.click()}
              >
                <ImagePlus className="h-4 w-4" />
                {isPending ? '...' : t('images.add')}
              </Button>
            </div>
          )}
        </div>
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
          {tCommon('close')}
        </Button>
      </DialogFooter>
    </>
  )
}
