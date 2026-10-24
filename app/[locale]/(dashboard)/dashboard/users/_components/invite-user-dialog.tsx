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
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useDialog,
} from '@peaklab/ui'
import { useLocale, useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { useRouter } from '@/i18n/routing'
import { toast, toastActionError } from '@/lib/toast'
import { inviteUserAction } from '../../../_lib/invitation-actions'
import type { FamilyOption, TeacherOption } from './users-table'

export function InviteUserDialog({
  families,
  teachers,
  mealsEnabled = false,
}: {
  families: FamilyOption[]
  teachers: TeacherOption[]
  mealsEnabled?: boolean
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
        <InviteForm families={families} teachers={teachers} mealsEnabled={mealsEnabled} />
      </DialogContent>
    </Dialog>
  )
}

function InviteForm({
  families,
  teachers,
  mealsEnabled,
}: {
  families: FamilyOption[]
  teachers: TeacherOption[]
  mealsEnabled: boolean
}) {
  const t = useTranslations('dashboard.pages.users.invite')
  const tRoles = useTranslations('roles')
  const locale = useLocale()
  const router = useRouter()
  const { setOpen } = useDialog()
  const [isPending, startTransition] = useTransition()
  const [role, setRole] = useState('PARENT')

  const roleItems = [
    { value: 'PARENT', label: tRoles('PARENT') },
    { value: 'ADMIN', label: tRoles('ADMIN') },
    { value: 'TEACHER', label: tRoles('TEACHER') },
    ...(mealsEnabled ? [{ value: 'CASHIER', label: tRoles('CASHIER') }] : []),
  ]
  const familyItems: Array<{ value: string | null; label: string }> = [
    { value: null, label: t('noFamily') },
    ...families.map((family) => ({ value: family.id, label: family.name })),
  ]
  const teacherItems = teachers.map((teacher) => ({
    value: teacher.id,
    label: `${teacher.name} — ${teacher.email ?? t('missingTeacherEmail')}`,
  }))
  const localeItems = [
    { value: 'fr', label: 'Français' },
    { value: 'en', label: 'English' },
  ]

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
              name="role"
              items={roleItems}
              required
              value={role}
              onValueChange={(value) => setRole(value ?? '')}
              disabled={isPending}
            >
              <SelectTrigger id="invite-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roleItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {role === 'PARENT' && families.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="invite-family">{t('family')}</Label>
              <Select name="familyId" items={familyItems} defaultValue={null} disabled={isPending}>
                <SelectTrigger id="invite-family">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {familyItems.map((item) => (
                    <SelectItem key={item.value ?? ''} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-graphite-600">{t('familyHint')}</p>
            </div>
          )}
          {role === 'TEACHER' && (
            <div className="space-y-2">
              <Label htmlFor="invite-teacher">{t('teacher')}</Label>
              <Select
                name="teacherId"
                items={teacherItems}
                required
                disabled={isPending}
                defaultValue={teacherItems[0]?.value}
              >
                <SelectTrigger id="invite-teacher">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {teacherItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-graphite-600">{t('teacherHint')}</p>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="invite-locale">{t('language')}</Label>
            <Select name="locale" items={localeItems} defaultValue={locale} disabled={isPending}>
              <SelectTrigger id="invite-locale">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {localeItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
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
