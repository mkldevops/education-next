'use client'

import { Button } from '@peaklab/ui'
import { LogIn } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { useRouter } from '@/i18n/routing'
import { impersonateUser } from '@/lib/auth-client'
import { toastActionError } from '@/lib/toast'

interface Props {
  userId: string
  disabled: boolean
}

export function ImpersonateUserButton({ userId, disabled }: Props) {
  const t = useTranslations('dashboard.pages.users')
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)

  async function handleClick() {
    setIsPending(true)
    const { error } = await impersonateUser({ userId }).catch(() => ({ error: { code: '' } }))

    if (error) {
      toastActionError(t, error.code ?? '')
      setIsPending(false)
      return
    }

    router.replace('/dashboard')
    router.refresh()
  }

  return (
    <Button variant="outline" size="sm" disabled={disabled || isPending} onClick={handleClick}>
      <LogIn className="size-4" />
      {isPending ? t('impersonating') : t('impersonate')}
    </Button>
  )
}
