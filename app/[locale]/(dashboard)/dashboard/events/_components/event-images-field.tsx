'use client'

import { Button, Input, Label } from '@peaklab/ui'
import { Trash2 } from 'lucide-react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { useRef, useState, useTransition } from 'react'
import { MAX_EVENT_IMAGES } from '@/domain/event'
import { toast, toastActionError } from '@/lib/toast'
import { removeEventImageAction, uploadEventImageAction } from '../../../_lib/event-actions'

type EventImageRow = {
  id: string
  storageKey: string
  alt: string | null
  position: number
}

type Props = {
  eventId: string
  images: EventImageRow[]
}

export function EventImagesField({ eventId, images: initialImages }: Props) {
  const t = useTranslations('dashboard.pages.events')
  const [images, setImages] = useState(initialImages)
  const [isPending, startTransition] = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const altInputRef = useRef<HTMLInputElement>(null)

  const handleFile = (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('eventId', eventId)
    formData.append('alt', altInputRef.current?.value ?? '')

    startTransition(async () => {
      const result = await uploadEventImageAction(formData)
      if (typeof result === 'string') {
        toastActionError(t, result)
      } else {
        setImages((prev) => [...prev, result])
        toast.success(t('success.imageAdded'))
        if (altInputRef.current) altInputRef.current.value = ''
      }
      if (fileInputRef.current) fileInputRef.current.value = ''
    })
  }

  const handleRemove = (imageId: string) => {
    startTransition(async () => {
      const result = await removeEventImageAction(eventId, imageId)
      if (typeof result === 'string') {
        toastActionError(t, result)
        return
      }
      setImages(result)
      toast.success(t('success.imageRemoved'))
    })
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-graphite-600">{t('images.hint')}</p>

      {images.length === 0 ? (
        <p className="text-sm text-graphite-600">{t('images.none')}</p>
      ) : (
        <ul className="grid grid-cols-3 gap-3">
          {images.map((image) => (
            <li key={image.id} className="relative">
              <Image
                src={`/api/media/${image.storageKey}`}
                alt={image.alt ?? ''}
                width={160}
                height={120}
                className="h-24 w-full rounded border border-alabaster-700 object-cover"
              />
              {image.position === 0 && (
                <span className="absolute left-1 top-1 rounded bg-graphite/80 px-1.5 py-0.5 text-[10px] font-medium text-white">
                  {t('images.cover')}
                </span>
              )}
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="absolute right-1 top-1 h-6 w-6 p-0"
                disabled={isPending}
                onClick={() => handleRemove(image.id)}
                aria-label={t('images.remove')}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {images.length < MAX_EVENT_IMAGES && (
        <div className="space-y-2">
          <Label htmlFor={`event-image-alt-${eventId}`}>{t('fields.alt')}</Label>
          <Input
            id={`event-image-alt-${eventId}`}
            ref={altInputRef}
            type="text"
            disabled={isPending}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            id={`event-image-file-${eventId}`}
            disabled={isPending}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFile(file)
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => fileInputRef.current?.click()}
          >
            {isPending ? '...' : t('images.add')}
          </Button>
        </div>
      )}
    </div>
  )
}
