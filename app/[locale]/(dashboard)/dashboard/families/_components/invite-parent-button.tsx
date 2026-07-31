'use client'

import { MailPlus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useTransition } from 'react'
import { Button } from '@/components/ui/button/button'
import { toast } from '@/lib/toast'
import { inviteUserAction } from '../../../_lib/invitation-actions'

type Props = {
  familyId: string
  personId: string
  email: string
}

export function InviteParentButton({ familyId, personId, email }: Props) {
  const t = useTranslations('dashboard.pages.familyDetails.portalInvitation')
  const [isPending, startTransition] = useTransition()

  const invite = () => {
    startTransition(async () => {
      const result = await inviteUserAction({
        email,
        role: 'PARENT',
        familyId,
        personId,
      })

      if (result === 'OK') {
        toast.success(t('success'))
        return
      }

      toast.error(t(result === 'emailAlreadyUsed' ? 'emailAlreadyUsed' : 'error'))
    })
  }

  return (
    <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={invite}>
      <MailPlus size={15} />
      {isPending ? t('pending') : t('action')}
    </Button>
  )
}
