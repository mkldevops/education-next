'use client'

import { Card } from '@peaklab/ui'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button/button'
import { Input, Label } from '@/components/ui/input/input'
import { useRouter } from '@/i18n/routing'
import { parseBlocks } from '@/lib/parse-blocks'
import { toast } from '@/lib/toast'
import type { Block } from '@/use-cases/pages/schemas'
import { updatePageAction } from '../../../_lib/page-actions'
import { BlockEditor } from './block-editor'

type PageData = {
  id: string
  slug: string
  title: string
  isHome: boolean
  published: boolean
  blocks: unknown
  sortOrder: number
}

export function EditPageForm({ page }: { page: PageData }) {
  const t = useTranslations('dashboard.pages.pages.edit')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [title, setTitle] = useState(page.title)
  const [slug, setSlug] = useState(page.slug)
  const [isHome, setIsHome] = useState(page.isHome)
  const [published, setPublished] = useState(page.published)
  const [blocks, setBlocks] = useState<Block[]>(() => parseBlocks(page.blocks))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      const result = await updatePageAction({
        id: page.id,
        title,
        slug,
        isHome,
        published,
        blocks,
        sortOrder: page.sortOrder,
      })
      if (result !== 'OK') {
        if (result === 'slugAlreadyExists') {
          toast.error(t('slugError'))
        } else {
          toast.error(t('error'))
        }
      } else {
        toast.success(t('success'))
        router.push('/dashboard/pages')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
      <Card className="rounded-xl border border-gray-200 p-6">
        <h2 className="mb-4 text-base font-semibold text-gray-900">{t('sectionMeta')}</h2>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-title">{t('titleLabel')}</Label>
            <Input
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={250}
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-slug">{t('slugLabel')}</Label>
            <Input
              id="edit-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              required
              maxLength={100}
              disabled={isPending}
              pattern="[a-z0-9-]+"
            />
          </div>
          <div className="flex items-center gap-6">
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
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={published}
                onChange={(e) => setPublished(e.target.checked)}
                disabled={isPending}
                className="h-4 w-4 rounded border-gray-300"
              />
              {t('published')}
            </label>
          </div>
        </div>
      </Card>

      <Card className="rounded-xl border border-gray-200 p-6">
        <h2 className="mb-4 text-base font-semibold text-gray-900">{t('sectionBlocks')}</h2>
        <BlockEditor blocks={blocks} onChange={setBlocks} />
      </Card>

      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/dashboard/pages')}
          disabled={isPending}
        >
          {t('cancel')}
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? '...' : t('submit')}
        </Button>
      </div>
    </form>
  )
}
