'use client'

import { useTranslations } from 'next-intl'
import { useTransition } from 'react'
import { Link, useRouter } from '@/i18n/routing'
import { toast } from '@/lib/toast'
import { deletePageAction } from '../../../_lib/page-actions'

type PageSummary = {
  id: string
  slug: string
  title: string
  isHome: boolean
  published: boolean
  sortOrder: number
  createdAt: Date
}

export function PageList({ pages }: { pages: PageSummary[] }) {
  const t = useTranslations('dashboard.pages.pages')

  if (pages.length === 0) {
    return <div className="py-12 text-center text-sm text-gray-500">{t('noPages')}</div>
  }

  return (
    <ul className="divide-y divide-gray-100">
      {pages.map((page) => (
        <PageRow key={page.id} page={page} />
      ))}
    </ul>
  )
}

function PageRow({ page }: { page: PageSummary }) {
  const t = useTranslations('dashboard.pages.pages')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deletePageAction(page.id)
      if (result !== 'OK') {
        toast.error(t('delete.error'))
      } else {
        toast.success(t('delete.success'))
        router.refresh()
      }
    })
  }

  return (
    <li className="flex items-center justify-between gap-4 px-6 py-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className="min-w-0">
          <p className="truncate font-medium text-gray-900">{page.title}</p>
          <p className="text-xs text-gray-500">/{page.slug}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          {page.isHome && (
            <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
              {t('badge.home')}
            </span>
          )}
          {!page.published && (
            <span className="inline-flex items-center rounded-full bg-yellow-50 px-2 py-0.5 text-xs font-medium text-yellow-700">
              {t('badge.draft')}
            </span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <a
          href={`/${page.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
        >
          {t('action.preview')}
        </a>
        <Link
          href={`/dashboard/pages/${page.id}`}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/5"
        >
          {t('action.edit')}
        </Link>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isPending}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          {t('action.delete')}
        </button>
      </div>
    </li>
  )
}
