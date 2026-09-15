'use client'

import { Button } from '@peaklab/ui'
import { LogOut } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { useRouter } from '@/i18n/routing'
import { stopImpersonating } from '@/lib/auth-client'
import { toast } from '@/lib/toast'

export function StopImpersonationButton() {
  const t = useTranslations('dashboard.impersonation')
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)

  async function handleClick() {
    setIsPending(true)
    const { error } = await stopImpersonating().catch(() => ({ error: true }))

    if (error) {
      toast.error(t('error'))
      setIsPending(false)
      return
    }

    router.replace('/dashboard/users')
    router.refresh()
  }

  return (
    <Button variant="outline" size="sm" disabled={isPending} onClick={handleClick}>
      <LogOut className="size-4" />
      {isPending ? t('stopping') : t('stop')}
    </Button>
  )
}
