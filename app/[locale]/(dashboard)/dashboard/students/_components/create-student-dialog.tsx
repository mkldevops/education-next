'use client'

import { Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useTransition } from 'react'
import { Button } from '@/components/ui/button/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRouteOpener,
  DialogTitle,
  DialogTrigger,
  useDialog,
} from '@/components/ui/dialog/dialog'
import { Input, Label, Textarea } from '@/components/ui/input/input'
import { useRouter } from '@/i18n/routing'
import { toast } from '@/lib/toast'
import { createStudentAction } from '../../../_lib/student-actions'

export function CreateStudentDialog({
  familyId,
  defaultOpen = false,
  redirectTo,
  showTrigger = true,
}: {
  familyId: string
  defaultOpen?: boolean
  redirectTo?: string
  showTrigger?: boolean
}) {
  const t = useTranslations('dashboard.pages.students.create')
  const routeAfterOpen = redirectTo ?? `/dashboard/families/${familyId}`

  return (
    <Dialog initialOpen={defaultOpen}>
      <DialogRouteOpener open={defaultOpen} cleanUrl={routeAfterOpen} />
      {showTrigger && (
        <DialogTrigger>
          <Button size="sm">
            <Plus className="h-4 w-4" />
            {t('title')}
          </Button>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>
        <CreateStudentForm familyId={familyId} />
      </DialogContent>
    </Dialog>
  )
}

function CreateStudentForm({ familyId }: { familyId: string }) {
  const t = useTranslations('dashboard.pages.students.create')
  const { setOpen } = useDialog()
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = await createStudentAction({
        familyId: formData.get('familyId') as string,
        person: {
          name: formData.get('name') as string,
          lastname: formData.get('lastname') as string,
          sex: formData.get('sex') as 'MALE' | 'FEMALE',
        },
        student: {
          birthday: new Date(formData.get('birthday') as string),
          birthplace: (formData.get('birthplace') as string) || undefined,
          allergies: (formData.get('allergies') as string) || undefined,
          healthNotes: (formData.get('healthNotes') as string) || undefined,
          languagesAtHome:
            (formData.get('languagesAtHome') as string)
              ?.split(',')
              .map((l) => l.trim())
              .filter(Boolean) ?? [],
          snackAuthorization: formData.get('snackAuthorization') === 'on',
        },
      })
      if (typeof result === 'string') {
        toast.error(t.has(`errors.${result}`) ? t(`errors.${result}`) : t('error'))
      } else {
        toast.success(t('success'))
        setOpen(false)
        if (familyId) router.push(`/dashboard/families/${familyId}`)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody>
        <div className="space-y-4">
          <input type="hidden" name="familyId" value={familyId} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="student-name">{t('firstname')}</Label>
              <Input id="student-name" name="name" required maxLength={250} disabled={isPending} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="student-lastname">{t('lastname')}</Label>
              <Input
                id="student-lastname"
                name="lastname"
                required
                maxLength={250}
                disabled={isPending}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="student-sex">{t('sex')}</Label>
              <select
                id="student-sex"
                name="sex"
                required
                disabled={isPending}
                className="flex h-10 w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm"
              >
                <option value="MALE">{t('male')}</option>
                <option value="FEMALE">{t('female')}</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="student-birthday">{t('birthday')}</Label>
              <Input
                id="student-birthday"
                name="birthday"
                type="date"
                required
                disabled={isPending}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="student-birthplace">{t('birthplace')}</Label>
              <Input
                id="student-birthplace"
                name="birthplace"
                maxLength={250}
                disabled={isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="student-allergies">{t('allergies')}</Label>
              <Input id="student-allergies" name="allergies" maxLength={250} disabled={isPending} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="student-health">{t('healthNotes')}</Label>
            <Textarea id="student-health" name="healthNotes" disabled={isPending} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="student-languages">{t('languages')}</Label>
            <Input
              id="student-languages"
              name="languagesAtHome"
              placeholder={t('languagesPlaceholder')}
              disabled={isPending}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="snackAuthorization" className="rounded" />
            {t('snackAuthorization')}
          </label>
        </div>
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
          {t('cancel')}
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? '...' : t('submit')}
        </Button>
      </DialogFooter>
    </form>
  )
}
