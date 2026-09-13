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
import { useTranslations } from 'next-intl'
import { useTransition } from 'react'
import { toast, toastActionError } from '@/lib/toast'
import {
  deactivateLevelAction,
  renameLevelAction,
  setNextLevelAction,
} from '../../../_lib/level-actions'

interface Level {
  id: string
  name: string
}

interface EditLevelFormProps {
  level: Level
  currentNextLevelId: string | null
  allLevels: Level[]
  takenNextLevelIds: string[]
  classPeriodCount: number
}

interface EditLevelDialogProps extends EditLevelFormProps {
  /** `menuitem` quand le déclencheur est une entrée de menu, pour la navigation au clavier. */
  triggerRole?: React.AriaRole
  /** Cible de repli du focus quand le déclencheur est devenu inaccessible à la fermeture. */
  restoreFocusRef?: React.RefObject<HTMLElement | null>
}

export function EditLevelDialog({ triggerRole, restoreFocusRef, ...props }: EditLevelDialogProps) {
  const t = useTranslations('dashboard.pages.levels.edit')

  return (
    <Dialog restoreFocusRef={restoreFocusRef}>
      <DialogTrigger>
        <Button variant="outline" size="sm" role={triggerRole}>
          {t('title')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>
        <EditLevelForm {...props} />
      </DialogContent>
    </Dialog>
  )
}

function EditLevelForm({
  level,
  currentNextLevelId,
  allLevels,
  takenNextLevelIds,
  classPeriodCount,
}: EditLevelFormProps) {
  const t = useTranslations('dashboard.pages.levels.edit')
  const { setOpen } = useDialog()
  const [isPending, startTransition] = useTransition()

  const selectableLevels = allLevels.filter(
    (l) => l.id !== level.id && (l.id === currentNextLevelId || !takenNextLevelIds.includes(l.id))
  )

  const notify = (result: string) => {
    if (result === 'OK') return true
    toastActionError(t, result)
    return false
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const name = (formData.get('name') as string).trim()
    const nextLevelId = (formData.get('nextLevelId') as string) || null

    startTransition(async () => {
      if (name !== level.name) {
        const renamed = await renameLevelAction({ id: level.id, name })
        if (!notify(renamed)) return
      }

      if (nextLevelId !== currentNextLevelId) {
        const linked = await setNextLevelAction({ id: level.id, nextLevelId })
        if (!notify(linked)) return
      }

      toast.success(t('success'))
      setOpen(false)
    })
  }

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deactivateLevelAction({ id: level.id })
      if (!notify(result)) return
      toast.success(t('deleteSuccess'))
      setOpen(false)
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-level-name">{t('name')}</Label>
            <Input
              id="edit-level-name"
              name="name"
              defaultValue={level.name}
              required
              maxLength={250}
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-next-level">{t('selectNextLevel')}</Label>
            <Select
              id="edit-next-level"
              name="nextLevelId"
              defaultValue={currentNextLevelId ?? ''}
              disabled={isPending}
            >
              <option value="">{t('noNext')}</option>
              {selectableLevels.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
            <p className="text-xs text-graphite-600">{t('nextLevelHint')}</p>
          </div>
        </div>
      </DialogBody>
      <DialogFooter className="justify-between">
        <Button
          type="button"
          variant="destructive"
          onClick={handleDelete}
          disabled={isPending || classPeriodCount > 0}
          title={classPeriodCount > 0 ? t('errors.levelInUse') : undefined}
        >
          {t('delete')}
        </Button>
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            {t('cancel')}
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? '...' : t('submit')}
          </Button>
        </div>
      </DialogFooter>
    </form>
  )
}
