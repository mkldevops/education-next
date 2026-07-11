'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState, useTransition } from 'react'
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
import { Input, Label, Textarea } from '@/components/ui/input/input'
import { useRouter } from '@/i18n/routing'
import { toast } from '@/lib/toast'
import { createFamilySchema } from '@/use-cases/families/schemas'
import { createFamilyAction } from '../../../_lib/family-actions'

export function CreateFamilyDialog({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const t = useTranslations('dashboard.pages.families.create')

  return (
    <Dialog initialOpen={defaultOpen}>
      <DialogTrigger>
        <Button>+ {t('title')}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>
        <CreateFamilyForm defaultOpen={defaultOpen} />
      </DialogContent>
    </Dialog>
  )
}

function CreateFamilyForm({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const t = useTranslations('dashboard.pages.families.create')
  const { setOpen } = useDialog()
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const [parentKeys, setParentKeys] = useState([0])
  const nextKey = useRef(1)

  useEffect(() => {
    if (defaultOpen) {
      setOpen(true)
      router.replace('/dashboard/families')
    }
  }, [defaultOpen, setOpen, router])

  const addParent = () => {
    setParentKeys((keys) => [...keys, nextKey.current])
    nextKey.current += 1
  }

  const removeParent = (key: number) => {
    setParentKeys((keys) => keys.filter((k) => k !== key))
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    const formData = new FormData(e.currentTarget)
    const parents = formData.getAll('parentName').map((name, i) => ({
      name: name as string,
      lastname: formData.getAll('parentLastname')[i] as string,
      sex: formData.getAll('parentSex')[i] as 'MALE' | 'FEMALE',
      email: (formData.getAll('parentEmail')[i] as string) || undefined,
      phoneNumber: (formData.getAll('parentPhone')[i] as string) || undefined,
    }))
    const rawData = {
      name: formData.get('name') as string,
      emergencyContact: (formData.get('emergencyContact') as string) || undefined,
      authorizedPickup: (formData.get('authorizedPickup') as string) || undefined,
      parents,
      address: (formData.get('address') as string) || undefined,
      postCode: (formData.get('postCode') as string) || undefined,
      city: (formData.get('city') as string) || undefined,
    }

    const parsed = createFamilySchema.safeParse(rawData)
    if (!parsed.success) {
      toast.error(t('error'))
      return
    }

    startTransition(async () => {
      const result = await createFamilyAction(parsed.data)
      if (typeof result === 'string') {
        toast.error(t('error'))
      } else {
        toast.success(t('success'))
        setOpen(false)
        setParentKeys([0])
        nextKey.current = 1
        router.push(`/dashboard/families/${result.id}`)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t('name')}</Label>
            <Input
              id="name"
              name="name"
              type="text"
              placeholder="Family name"
              required
              maxLength={50}
              disabled={isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="emergencyContact">{t('emergencyContact')}</Label>
            <Input
              id="emergencyContact"
              name="emergencyContact"
              type="text"
              placeholder="Contact name and phone"
              maxLength={250}
              disabled={isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="authorizedPickup">{t('authorizedPickup')}</Label>
            <Textarea
              id="authorizedPickup"
              name="authorizedPickup"
              placeholder="Names of authorized persons..."
              disabled={isPending}
            />
          </div>

          <div className="space-y-3 border-t pt-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-900">{t('parentsTitle')}</span>
              <Button type="button" variant="outline" size="sm" onClick={addParent}>
                + {t('addParent')}
              </Button>
            </div>
            {parentKeys.map((key, index) => (
              <div key={key} className="space-y-3 rounded-lg border border-gray-200 p-3">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor={`parent-name-${key}`}>{t('firstname')}</Label>
                    <Input
                      id={`parent-name-${key}`}
                      name="parentName"
                      required
                      maxLength={250}
                      disabled={isPending}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`parent-lastname-${key}`}>{t('lastname')}</Label>
                    <Input
                      id={`parent-lastname-${key}`}
                      name="parentLastname"
                      required
                      maxLength={250}
                      disabled={isPending}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor={`parent-sex-${key}`}>{t('sex')}</Label>
                    <select
                      id={`parent-sex-${key}`}
                      name="parentSex"
                      required
                      disabled={isPending}
                      className="flex h-10 w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm"
                    >
                      <option value="MALE">{t('male')}</option>
                      <option value="FEMALE">{t('female')}</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`parent-phone-${key}`}>{t('phone')}</Label>
                    <Input
                      id={`parent-phone-${key}`}
                      name="parentPhone"
                      type="tel"
                      maxLength={20}
                      disabled={isPending}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`parent-email-${key}`}>{t('email')}</Label>
                  <Input
                    id={`parent-email-${key}`}
                    name="parentEmail"
                    type="email"
                    maxLength={250}
                    disabled={isPending}
                  />
                </div>
                {index > 0 && (
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeParent(key)}
                      disabled={isPending}
                    >
                      {t('removeParent')}
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="space-y-3 border-t pt-4">
            <span className="text-sm font-medium text-gray-900">{t('addressTitle')}</span>
            <div className="space-y-2">
              <Label htmlFor="address">{t('address')}</Label>
              <Input id="address" name="address" maxLength={250} disabled={isPending} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="postCode">{t('postCode')}</Label>
                <Input id="postCode" name="postCode" maxLength={10} disabled={isPending} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">{t('city')}</Label>
                <Input id="city" name="city" maxLength={250} disabled={isPending} />
              </div>
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
