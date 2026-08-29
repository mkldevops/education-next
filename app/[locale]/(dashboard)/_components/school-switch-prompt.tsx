'use client'

import { Button, Card } from '@peaklab/ui'
import { Building2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { switchSchoolAction } from '@/actions/school-actions'

type Props = {
  schoolId: string
  schoolName: string
}

/**
 * Écran proposé quand un lien profond désigne une ressource d'une autre école
 * autorisée. Le lien partagé n'emporte pas son contexte : plutôt que `notFound()`,
 * on propose la bascule, puis on rafraîchit pour rejouer la page dans la bonne école.
 */
export function SchoolSwitchPrompt({ schoolId, schoolName }: Props) {
  const t = useTranslations('schools.deepLink')
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [failed, setFailed] = useState(false)

  function onSwitch() {
    setFailed(false)
    startTransition(async () => {
      const result = await switchSchoolAction(schoolId)
      if (result !== 'OK') {
        setFailed(true)
        return
      }
      router.refresh()
    })
  }

  return (
    <Card className="mx-auto max-w-xl p-8 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
        <Building2 className="h-6 w-6 text-primary" />
      </span>
      <h1 className="mt-4 text-xl font-semibold text-gray-900">{t('title')}</h1>
      <p className="mt-2 text-sm text-gray-600">{t('description', { schoolName })}</p>
      {failed && <p className="mt-4 text-sm text-red-600">{t('error')}</p>}
      <div className="mt-6 flex justify-center">
        <Button onClick={onSwitch} disabled={pending}>
          {t('switchTo', { schoolName })}
        </Button>
      </div>
    </Card>
  )
}
