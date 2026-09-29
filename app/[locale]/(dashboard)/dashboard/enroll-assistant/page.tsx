import { buttonVariants, EmptyState, PageHeader } from '@peaklab/ui'
import { KeyRound, Settings } from 'lucide-react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { resolveAiAssistantModel } from '@/domain/ai-assistant'
import { Link } from '@/i18n/routing'
import { isAiAssistantEnabled } from '@/use-cases/platform-settings/is-ai-assistant-enabled'
import { getOpenRouterKeyStatus } from '@/use-cases/platform-settings/openrouter-api-key'
import { AssistantChat } from '../../_components/ai-chat/assistant-chat'
import { requireSchoolAdmin } from '../../_lib/auth-helper'
import { restrictedPageMetadata } from '../../_lib/page-metadata'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  return restrictedPageMetadata(locale, 'dashboard.pages.enrollAssistant.title')
}

/**
 * Réservée aux administrateurs de l'école active, et absente tant que le drapeau est
 * fermé : la page ne se distingue pas d'une route inexistante. La clé se lit ici comme
 * un état (« configurée » ou non), jamais comme une valeur.
 */
export default async function EnrollAssistantPage({ params }: Props) {
  await connection()
  const { locale } = await params
  setRequestLocale(locale)

  const { schoolId, isSuperAdmin } = await requireSchoolAdmin()
  if (!(await isAiAssistantEnabled())) notFound()

  const t = await getTranslations('dashboard.pages.enrollAssistant')
  const tBreadcrumbs = await getTranslations('dashboard.breadcrumbs')

  const keyStatus = await getOpenRouterKeyStatus()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('title')}
        description={t('description')}
        breadcrumbs={[
          { label: tBreadcrumbs('dashboard'), href: '/dashboard', icon: 'home' },
          { label: tBreadcrumbs('enrollAssistant') },
        ]}
      />

      {keyStatus === 'configured' ? (
        <AssistantChat
          key={schoolId}
          model={resolveAiAssistantModel(process.env.AI_ASSISTANT_MODEL)}
          className="h-[calc(100dvh-18rem)] min-h-112"
          listClassName="max-h-none flex-1"
        />
      ) : (
        <EmptyState
          icon={KeyRound}
          title={t('unavailable.title')}
          description={t('unavailable.description')}
          action={
            isSuperAdmin && (
              <Link
                href="/dashboard/config#integrations"
                className={buttonVariants({ variant: 'outline', size: 'sm' })}
              >
                <Settings className="h-4 w-4" />
                {t('unavailable.configure')}
              </Link>
            )
          }
        />
      )}
    </div>
  )
}
