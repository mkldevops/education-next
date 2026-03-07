'use client'

import { useTranslations } from 'next-intl'
import { useTransition } from 'react'
import { Button } from '@/components/ui/button/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  useDialog,
} from '@/components/ui/dialog/dialog'
import { Input, Label } from '@/components/ui/input/input'
import { toast } from '@/lib/toast'
import { createClassPeriodAction } from '../../../_lib/class-period-actions'

interface Option {
  id: string
  name: string
}

interface CreateClassDialogProps {
  levels: Option[]
  periods: Option[]
}

export function CreateClassDialog({ levels, periods }: CreateClassDialogProps) {
  const t = useTranslations('dashboard.pages.classes.create')

  return (
    <Dialog>
      <DialogTrigger>
        <Button>+ {t('title')}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>
        <CreateClassForm levels={levels} periods={periods} />
      </DialogContent>
    </Dialog>
  )
}

function CreateClassForm({ levels, periods }: CreateClassDialogProps) {
  const t = useTranslations('dashboard.pages.classes.create')
  const { setOpen } = useDialog()
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = await createClassPeriodAction({
        name: formData.get('name') as string,
        capacity: Number(formData.get('capacity')),
        levelId: formData.get('levelId') as string,
        periodId: formData.get('periodId') as string,
      })
      if (typeof result === 'string') {
        toast.error(t('error'))
      } else {
        toast.success(t('success'))
        setOpen(false)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="class-name">{t('name')}</Label>
            <Input
              id="class-name"
              name="name"
              required
              maxLength={250}
              placeholder="CP-A, CE1-B..."
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="class-capacity">{t('capacity')}</Label>
            <Input
              id="class-capacity"
              name="capacity"
              type="number"
              min={1}
              required
              disabled={isPending}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="class-level">{t('selectLevel')}</Label>
              <select
                id="class-level"
                name="levelId"
                required
                disabled={isPending}
                className="flex h-10 w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm"
              >
                {levels.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="class-period">{t('selectPeriod')}</Label>
              <select
                id="class-period"
                name="periodId"
                required
                disabled={isPending}
                className="flex h-10 w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm"
              >
                {periods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
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
