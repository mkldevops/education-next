import { EmptyState, PageHeader } from '@peaklab/ui'
import { KeyRound } from 'lucide-react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { resolveAiAssistantModel } from '@/domain/ai-assistant'
import { schoolGateway } from '@/gateways/school-gateway'
import { isPaymentsEnabled } from '@/use-cases/config/is-payments-enabled'
import { isAiAssistantEnabled } from '@/use-cases/platform-settings/is-ai-assistant-enabled'
import { getOpenRouterKeyStatus } from '@/use-cases/platform-settings/openrouter-api-key'
import { requireSchoolAdmin } from '../../_lib/auth-helper'
import { restrictedPageMetadata } from '../../_lib/page-metadata'
import { EnrollAssistant } from './_components/enroll-assistant'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  return restrictedPageMetadata(locale, 'pages.enrollAssistant.title')
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

  const { schoolId } = await requireSchoolAdmin()
  if (!(await isAiAssistantEnabled())) notFound()

  const t = await getTranslations('dashboard.pages.enrollAssistant')
  const tBreadcrumbs = await getTranslations('dashboard.breadcrumbs')

  const [keyStatus, school, paymentsEnabled] = await Promise.all([
    getOpenRouterKeyStatus(),
    schoolGateway.findActiveById(schoolId),
    isPaymentsEnabled(schoolId),
  ])
  if (!school) notFound()

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
        <EnrollAssistant
          key={schoolId}
          schoolName={school.name}
          paymentsEnabled={paymentsEnabled}
          model={resolveAiAssistantModel(process.env.AI_ASSISTANT_MODEL)}
        />
      ) : (
        <EmptyState
          icon={KeyRound}
          title={t('unavailable.title')}
          description={t('unavailable.description')}
        />
      )}
    </div>
  )
}
