import { Card } from '@peaklab/ui'
import { MailQuestion } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

type Props = {
  userName: string | null
  schoolName: string
}

export async function UnlinkedParentNotice({ userName, schoolName }: Props) {
  const t = await getTranslations('dashboard.unlinkedParent')

  return (
    <Card className="mx-auto max-w-xl p-8 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
        <MailQuestion className="h-6 w-6 text-amber-700" />
      </span>
      <h1 className="mt-4 text-xl font-semibold text-graphite">
        {userName ? t('greeting', { name: userName }) : t('title')}
      </h1>
      <p className="mt-2 text-sm text-graphite-600">{t('description')}</p>
      <p className="mt-4 text-sm text-graphite-600">{t('nextStep', { schoolName })}</p>
    </Card>
  )
}
