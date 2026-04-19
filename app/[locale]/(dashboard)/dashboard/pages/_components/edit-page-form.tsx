'use client'

import { Card } from '@peaklab/ui'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button/button'
import { Input, Label } from '@/components/ui/input/input'
import { BlockRenderer } from '@/features/landing/block-renderer'
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
    <form onSubmit={handleSubmit} className="flex h-[calc(100vh-180px)] gap-0">
      <div className="w-[420px] flex-shrink-0 flex flex-col border-r border-gray-200">
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
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
          </div>
        </div>

        <div className="sticky bottom-0 flex justify-end gap-3 border-t border-gray-200 bg-white p-6">
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
      </div>

      <div className="flex-1 overflow-hidden relative bg-gray-100">
        <div className="absolute inset-0 flex flex-col">
          <div className="h-12 border-b border-gray-300 bg-gray-200 flex items-center px-4 flex-shrink-0">
            <span className="text-xs font-medium text-gray-700">Preview</span>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <div
              className="mx-auto bg-white rounded-lg shadow-sm"
              style={{ width: 'calc(100% / 0.65)' }}
            >
              <div style={{ transform: 'scale(0.65)', transformOrigin: 'top left' }}>
                {blocks.length === 0 ? (
                  <div className="flex items-center justify-center py-20 text-gray-500">
                    <p className="text-sm">{t('noBlocks')}</p>
                  </div>
                ) : (
                  <BlockRenderer blocks={blocks} />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </form>
  )
}
