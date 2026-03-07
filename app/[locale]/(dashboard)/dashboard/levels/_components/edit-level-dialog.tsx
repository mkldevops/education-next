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
import { Label } from '@/components/ui/input/input'
import { toast } from '@/lib/toast'
import { setNextLevelAction } from '../../../_lib/level-actions'

interface Level {
  id: string
  name: string
}

interface EditLevelDialogProps {
  level: Level
  currentNextLevelId: string | null
  allLevels: Level[]
}

export function EditLevelDialog({ level, currentNextLevelId, allLevels }: EditLevelDialogProps) {
  const t = useTranslations('dashboard.pages.levels.edit')

  return (
    <Dialog>
      <DialogTrigger>
        <Button variant="outline" size="sm">
          {t('title')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>
        <EditLevelForm
          level={level}
          currentNextLevelId={currentNextLevelId}
          allLevels={allLevels}
        />
      </DialogContent>
    </Dialog>
  )
}

function EditLevelForm({ level, currentNextLevelId, allLevels }: EditLevelDialogProps) {
  const t = useTranslations('dashboard.pages.levels.edit')
  const { setOpen } = useDialog()
  const [isPending, startTransition] = useTransition()

  const otherLevels = allLevels.filter((l) => l.id !== level.id)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const nextLevelId = (formData.get('nextLevelId') as string) || null

    startTransition(async () => {
      const result = await setNextLevelAction({
        id: level.id,
        nextLevelId,
      })
      if (result !== 'OK') {
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
            <Label htmlFor="edit-next-level">{t('selectNextLevel')}</Label>
            <select
              id="edit-next-level"
              name="nextLevelId"
              defaultValue={currentNextLevelId ?? ''}
              disabled={isPending}
              className="flex h-10 w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm"
            >
              <option value="">{t('noNext')}</option>
              {otherLevels.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
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
