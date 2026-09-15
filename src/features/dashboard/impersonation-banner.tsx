import { ShieldAlert } from 'lucide-react'
import { headers } from 'next/headers'
import { getTranslations } from 'next-intl/server'
import { auth } from '@/lib/auth'
import { StopImpersonationButton } from './stop-impersonation-button'

export async function ImpersonationBanner() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.session.impersonatedBy) return null

  const t = await getTranslations('dashboard.impersonation')
  const displayName = session.user.name || session.user.email

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <ShieldAlert className="size-4 shrink-0 text-amber-700" />
          <span className="truncate font-medium">{t('label', { user: displayName })}</span>
        </div>
        <StopImpersonationButton />
      </div>
    </div>
  )
}
