'use client'

import { Button } from '@peaklab/ui'
import { RotateCcw } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useTransition } from 'react'
import { useRouter } from '@/i18n/routing'
import { toast, toastActionError } from '@/lib/toast'
import { reinstateStudentAction } from '../../../_lib/student-actions'

type Props = {
  studentId: string
  /** Page ouverte après la réintégration ; à défaut, la page courante est rafraîchie. */
  redirectTo?: string
  size?: 'sm' | 'default'
}

/** Réintègre un élève archivé ; ses inscriptions closes le restent, on le réinscrit ensuite. */
export function ReinstateStudentButton({ studentId, redirectTo, size = 'sm' }: Props) {
  const t = useTranslations('dashboard.pages.students.reinstate')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const reinstate = () =>
    startTransition(async () => {
      const result = await reinstateStudentAction(studentId)
      if (result !== 'OK') {
        toastActionError(t, result)
        return
      }
      toast.success(t('success'))
      if (redirectTo) router.push(redirectTo)
      else router.refresh()
    })

  return (
    <Button variant="outline" size={size} onClick={reinstate} disabled={isPending}>
      <RotateCcw className="h-4 w-4" />
      {t('trigger')}
    </Button>
  )
}
