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
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-warning-subtle">
        <MailQuestion className="size-6 text-warning" />
      </span>
      <h1 className="mt-4 text-xl font-semibold tracking-tight text-foreground">
        {userName ? t('greeting', { name: userName }) : t('title')}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">{t('description')}</p>
      <p className="mt-4 text-sm text-muted-foreground">{t('nextStep', { schoolName })}</p>
    </Card>
  )
}
