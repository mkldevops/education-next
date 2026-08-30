'use client'

import { Card } from '@peaklab/ui'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { useRouter } from '@/i18n/routing'
import { toast } from '@/lib/toast'
import { setSchoolSwitchEnabledAction } from '../../../_lib/platform-settings-actions'

type Props = {
  enabled: boolean
}

/**
 * Interrupteur plateforme de la bascule d'école. La case reflète l'état optimiste et
 * revient en arrière si l'écriture est refusée : le réglage gouverne toute l'instance,
 * afficher un état qui n'a pas été enregistré serait pire que l'attente.
 */
export function SchoolSwitchSetting({ enabled }: Props) {
  const t = useTranslations('schools.admin.platformSwitch')
  const router = useRouter()
  const [checked, setChecked] = useState(enabled)
  const [pending, startTransition] = useTransition()

  const onToggle = (next: boolean) => {
    setChecked(next)
    startTransition(async () => {
      const result = await setSchoolSwitchEnabledAction(next)
      if (result !== 'OK') {
        setChecked(!next)
        toast.error(t('error'))
        return
      }
      router.refresh()
    })
  }

  return (
    <Card className="rounded border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900">{t('title')}</h2>
      <p className="mt-1 text-sm text-gray-600">{t('description')}</p>
      <label className="mt-4 flex items-center gap-2 text-sm text-gray-800">
        <input
          type="checkbox"
          checked={checked}
          disabled={pending}
          onChange={(event) => onToggle(event.target.checked)}
          className="h-4 w-4 rounded border-gray-300"
        />
        {checked ? t('enabled') : t('disabled')}
      </label>
    </Card>
  )
}
