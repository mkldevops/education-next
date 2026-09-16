'use client'

import { Button } from '@peaklab/ui'
import { Link2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { toast } from '@/lib/toast'

export function SharePublicScheduleLink({ href }: { href: string }) {
  const t = useTranslations('dashboard.pages.planning.publicLink')

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${href}`)
      toast.success(t('copied'))
    } catch {
      toast.error(t('copyFailed'))
    }
  }

  return (
    <Button variant="outline" onClick={copyLink}>
      <Link2 className="h-4 w-4" />
      {t('copy')}
    </Button>
  )
}
