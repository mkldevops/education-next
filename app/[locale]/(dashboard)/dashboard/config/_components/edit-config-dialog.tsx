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
import { useRouter } from '@/i18n/routing'
import { toast } from '@/lib/toast'
import { setConfigAction } from '../../../_lib/config-actions'

interface EditConfigDialogProps {
  config: {
    name: string
    value: string
    valueType: 'TEXT' | 'NUMBER' | 'BOOLEAN' | 'COLOR'
  }
}

export function EditConfigDialog({ config }: EditConfigDialogProps) {
  const t = useTranslations('dashboard.pages.config.edit')

  return (
    <Dialog>
      <DialogTrigger>
        <Button variant="outline" size="sm">
          {t('title')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t('title')} — {config.name}
          </DialogTitle>
        </DialogHeader>
        <EditConfigForm config={config} />
      </DialogContent>
    </Dialog>
  )
}

function EditConfigForm({ config }: EditConfigDialogProps) {
  const t = useTranslations('dashboard.pages.config.edit')
  const { setOpen } = useDialog()
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)

    let value: string
    if (config.valueType === 'BOOLEAN') {
      value = formData.get('value') ? 'true' : 'false'
    } else {
      value = formData.get('value') as string
    }

    startTransition(async () => {
      const result = await setConfigAction({
        name: config.name,
        value,
        valueType: config.valueType,
      })
      if (typeof result === 'string') {
        toast.error(t('error'))
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
            <Label htmlFor="edit-config-value">{t('value')}</Label>
            {config.valueType === 'BOOLEAN' ? (
              <label className="flex items-center gap-2 text-sm">
                <input
                  id="edit-config-value"
                  name="value"
                  type="checkbox"
                  defaultChecked={config.value === 'true'}
                  disabled={isPending}
                  className="h-4 w-4 rounded border-gray-300"
                />
                {config.value === 'true' ? t('true') : t('false')}
              </label>
            ) : config.valueType === 'COLOR' ? (
              <div className="flex items-center gap-3">
                <input
                  id="edit-config-value"
                  name="value"
                  type="color"
                  defaultValue={config.value}
                  required
                  disabled={isPending}
                  className="h-10 w-16 cursor-pointer rounded border border-gray-300 p-1"
                />
                <Input
                  name="color-text"
                  type="text"
                  defaultValue={config.value}
                  pattern="^#[0-9a-fA-F]{6}$"
                  placeholder="#3c6e71"
                  disabled={isPending}
                  className="flex-1"
                  onChange={(e) => {
                    const colorInput = e.currentTarget
                      .closest('form')
                      ?.querySelector<HTMLInputElement>('#edit-config-value')
                    if (colorInput && /^#[0-9a-fA-F]{6}$/.test(e.target.value)) {
                      colorInput.value = e.target.value
                    }
                  }}
                />
              </div>
            ) : (
              <Input
                id="edit-config-value"
                name="value"
                type={config.valueType === 'NUMBER' ? 'number' : 'text'}
                step={config.valueType === 'NUMBER' ? 'any' : undefined}
                defaultValue={config.value}
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
