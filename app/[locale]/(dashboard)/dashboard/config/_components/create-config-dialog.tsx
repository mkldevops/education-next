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
  useDialog,
} from '@peaklab/ui'
import { Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { useRouter } from '@/i18n/routing'
import { toast, toastActionError } from '@/lib/toast'
import { setConfigAction } from '../../../_lib/config-actions'

export function CreateConfigDialog() {
  const t = useTranslations('dashboard.pages.config.create')

  return (
    <Dialog>
      <DialogTrigger>
        <Button>
          <Plus className="h-4 w-4" />
          {t('title')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>
        <CreateConfigForm />
      </DialogContent>
    </Dialog>
  )
}

function CreateConfigForm() {
  const t = useTranslations('dashboard.pages.config.create')
  const { setOpen } = useDialog()
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const [valueType, setValueType] = useState<'TEXT' | 'NUMBER' | 'BOOLEAN' | 'COLOR'>('TEXT')

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)

    let value: string
    if (valueType === 'BOOLEAN') {
      value = formData.get('value') ? 'true' : 'false'
    } else {
      value = formData.get('value') as string
    }

    startTransition(async () => {
      const result = await setConfigAction({
        name: formData.get('name') as string,
        value,
        valueType,
      })
      if (typeof result === 'string') {
        toastActionError(t, result)
      } else {
        toast.success(t('success'))
        setOpen(false)
        router.refresh()
      }
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="config-name">{t('name')}</Label>
            <Input id="config-name" name="name" required maxLength={250} disabled={isPending} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="config-type">{t('valueType')}</Label>
            <select
              id="config-type"
              value={valueType}
              onChange={(e) =>
                setValueType(e.target.value as 'TEXT' | 'NUMBER' | 'BOOLEAN' | 'COLOR')
              }
              disabled={isPending}
              className="flex h-10 w-full rounded border border-gray-300 bg-transparent px-3 py-2 text-sm"
            >
              <option value="TEXT">{t('types.TEXT')}</option>
              <option value="NUMBER">{t('types.NUMBER')}</option>
              <option value="BOOLEAN">{t('types.BOOLEAN')}</option>
              <option value="COLOR">{t('types.COLOR')}</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="config-value">{t('value')}</Label>
            {valueType === 'BOOLEAN' ? (
              <label className="flex items-center gap-2 text-sm">
                <input
                  id="config-value"
                  name="value"
                  type="checkbox"
                  disabled={isPending}
                  className="h-4 w-4 rounded border-gray-300"
                />
                {t('enabled')}
              </label>
            ) : valueType === 'COLOR' ? (
              <input
                id="config-value"
                name="value"
                type="color"
                defaultValue="#3c6e71"
                required
                disabled={isPending}
                className="h-10 w-16 cursor-pointer rounded border border-gray-300 p-1"
              />
            ) : (
              <Input
                id="config-value"
                name="value"
                type={valueType === 'NUMBER' ? 'number' : 'text'}
                step={valueType === 'NUMBER' ? 'any' : undefined}
                required
                disabled={isPending}
              />
            )}
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
