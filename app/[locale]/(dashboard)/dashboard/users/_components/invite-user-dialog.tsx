'use client'

import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  Select,
  useDialog,
} from '@peaklab/ui'
import { useLocale, useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { useRouter } from '@/i18n/routing'
import { toast, toastActionError } from '@/lib/toast'
import { inviteUserAction } from '../../../_lib/invitation-actions'

type Family = { id: string; name: string }
type Teacher = { id: string; name: string; email: string | null }

export function InviteUserDialog({
  families,
  teachers,
}: {
  families: Family[]
  teachers: Teacher[]
}) {
  const t = useTranslations('dashboard.pages.users.invite')

  return (
    <Dialog>
      <DialogTrigger>
        <Button>{t('button')}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>
        <InviteForm families={families} teachers={teachers} />
      </DialogContent>
    </Dialog>
  )
}

function InviteForm({ families, teachers }: { families: Family[]; teachers: Teacher[] }) {
  const t = useTranslations('dashboard.pages.users.invite')
  const tRoles = useTranslations('roles')
  const locale = useLocale()
  const router = useRouter()
  const { setOpen } = useDialog()
  const [isPending, startTransition] = useTransition()
  const [role, setRole] = useState('PARENT')

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = await inviteUserAction({
        email: formData.get('email') as string,
        role: formData.get('role') as string,
        locale: formData.get('locale') as string,
        familyId: (formData.get('familyId') as string) || undefined,
        teacherId: (formData.get('teacherId') as string) || undefined,
      })
      if (result === 'OK') {
        toast.success(t('success', { email: formData.get('email') as string }))
        setOpen(false)
        router.refresh()
      } else {
        toastActionError(t, result)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invite-email">{t('email')}</Label>
            <Input
              id="invite-email"
              name="email"
              type="email"
              required
              disabled={isPending}
              placeholder={t('emailPlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-role">{t('role')}</Label>
            <Select
              id="invite-role"
              name="role"
              required
              value={role}
              onChange={(e) => setRole(e.target.value)}
              disabled={isPending}
            >
              <option value="PARENT">{tRoles('PARENT')}</option>
              <option value="ADMIN">{tRoles('ADMIN')}</option>
              <option value="TEACHER">{tRoles('TEACHER')}</option>
            </Select>
          </div>
          {role === 'PARENT' && families.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="invite-family">{t('family')}</Label>
              <Select id="invite-family" name="familyId" defaultValue="" disabled={isPending}>
                <option value="">{t('noFamily')}</option>
                {families.map((family) => (
                  <option key={family.id} value={family.id}>
                    {family.name}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-graphite-600">{t('familyHint')}</p>
            </div>
          )}
          {role === 'TEACHER' && (
            <div className="space-y-2">
              <Label htmlFor="invite-teacher">{t('teacher')}</Label>
              <Select id="invite-teacher" name="teacherId" required disabled={isPending}>
                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.name} — {teacher.email ?? t('missingTeacherEmail')}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-graphite-600">{t('teacherHint')}</p>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="invite-locale">{t('language')}</Label>
            <Select id="invite-locale" name="locale" defaultValue={locale} disabled={isPending}>
              <option value="fr">Français</option>
              <option value="en">English</option>
            </Select>
          </div>
        </div>
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
          {t('cancel')}
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? '...' : t('send')}
        </Button>
      </DialogFooter>
    </form>
  )
}
