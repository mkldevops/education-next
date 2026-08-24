'use client'

import { useTranslations } from 'next-intl'
import { useRef, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button/button'
import { Input } from '@/components/ui/input/input'
import { toast, toastActionError } from '@/lib/toast'
import { uploadBrandingImageAction } from '../../../_lib/media-actions'

type Props = {
  id: string
  name: string
  defaultValue: string
  disabled?: boolean
}

export function ImageValueField({ id, name, defaultValue, disabled }: Props) {
  const t = useTranslations('dashboard.pages.config.image')
  const [value, setValue] = useState(defaultValue)
  const [isUploading, startUpload] = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = (file: File) => {
    const formData = new FormData()
    formData.append('file', file)

    startUpload(async () => {
      const result = await uploadBrandingImageAction(formData)
      if (result.result === 'OK') {
        setValue(result.url)
        toast.success(t('uploaded'))
      } else {
        toastActionError(t, result.result)
      }
      if (fileInputRef.current) fileInputRef.current.value = ''
    })
  }

  return (
    <div className="space-y-3">
      <Input
        id={id}
        name={name}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={t('urlPlaceholder')}
        disabled={disabled || isUploading}
      />

      <div className="flex items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon"
          className="sr-only"
          id={`${id}-file`}
          disabled={disabled || isUploading}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFile(file)
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || isUploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {isUploading ? t('uploading') : t('upload')}
        </Button>
        <span className="text-xs text-gray-500">{t('hint')}</span>
      </div>

      {value && (
        // biome-ignore lint/performance/noImgElement: previewing an arbitrary configured URL
        <img
          src={value}
          alt={t('preview')}
          className="h-12 w-auto rounded border border-gray-200 bg-white object-contain p-1"
        />
      )}
    </div>
  )
}
