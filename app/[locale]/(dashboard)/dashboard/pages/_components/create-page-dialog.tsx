'use client'

import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  useDialog,
} from '@/components/ui/dialog/dialog'
import { Input, Label } from '@/components/ui/input/input'
import { useRouter } from '@/i18n/routing'
import { toast } from '@/lib/toast'
import { createPageAction } from '../../../_lib/page-actions'

export function CreatePageDialog() {
  const t = useTranslations('dashboard.pages.pages.create')
  return (
    <Dialog>
      <DialogTrigger>
        <Button>+ {t('title')}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>
        <CreatePageForm />
      </DialogContent>
    </Dialog>
  )
}

function CreatePageForm() {
  const t = useTranslations('dashboard.pages.pages.create')
  const { setOpen } = useDialog()
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const [isHome, setIsHome] = useState(false)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)

    const title = formData.get('title') as string
    const rawSlug = formData.get('slug') as string
    const slug =
      rawSlug ||
      title
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')

    startTransition(async () => {
      const result = await createPageAction({
        title,
        slug,
        isHome,
        published: true,
        blocks: [],
        sortOrder: 0,
      })
      if (result !== 'OK') {
        if (result === 'slugAlreadyExists') {
          toast.error(t('slugError'))
        } else {
          toast.error(t('error'))
        }
      } else {
        toast.success(t('success'))
        setOpen(false)
        router.refresh()
      }
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="page-title">{t('titleLabel')}</Label>
            <Input id="page-title" name="title" required maxLength={250} disabled={isPending} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="page-slug">{t('slugLabel')}</Label>
            <Input
              id="page-slug"
              name="slug"
              maxLength={100}
              disabled={isPending}
              placeholder={t('slugPlaceholder')}
            />
            <p className="text-xs text-gray-500">{t('slugHint')}</p>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={isHome}
              onChange={(e) => setIsHome(e.target.checked)}
              disabled={isPending}
              className="h-4 w-4 rounded border-gray-300"
            />
            {t('isHome')}
          </label>
        </div>
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
          {t('cancel')}
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? '...' : t('submit')}
        </Button>
      </DialogFooter>
    </form>
  )
}
