'use client'

import { Button, Input, Label, Textarea } from '@peaklab/ui'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

export function ContactForm() {
  const t = useTranslations('contact.form')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)

    // Simulate form submission
    await new Promise((resolve) => setTimeout(resolve, 1000))

    setIsSubmitting(false)
    setIsSuccess(true)
  }

  if (isSuccess) {
    return (
      <div className="rounded-lg bg-green-50 p-6 text-center">
        <p className="text-green-800">{t('success')}</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <Label htmlFor="name">{t('name')}</Label>
        <Input id="name" name="name" required className="mt-1" />
      </div>

      <div>
        <Label htmlFor="email">{t('email')}</Label>
        <Input id="email" name="email" type="email" required className="mt-1" />
      </div>

      <div>
        <Label htmlFor="subject">{t('subject')}</Label>
        <Input id="subject" name="subject" required className="mt-1" />
      </div>

      <div>
        <Label htmlFor="message">{t('message')}</Label>
        <Textarea id="message" name="message" rows={5} required className="mt-1" />
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? '...' : t('submit')}
      </Button>
    </form>
  )
}
