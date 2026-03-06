import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

type Props = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'pages.about' })

  return {
    title: t('title'),
    description: t('description'),
  }
}

export default async function AboutPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('pages.about')

  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="display-lg text-gray-900">{t('title')}</h1>

      <div className="mt-12 prose prose-gray max-w-none">
        <p className="text-lg text-gray-600">{t('intro')}</p>

        <h2>{t('mission.title')}</h2>
        <p>{t('mission.description')}</p>

        <h2>{t('values.title')}</h2>
        <ul>
          <li>
            <strong>{t('values.innovation.title')}</strong> - {t('values.innovation.description')}
          </li>
          <li>
            <strong>{t('values.quality.title')}</strong> - {t('values.quality.description')}
          </li>
          <li>
            <strong>{t('values.collaboration.title')}</strong> -{' '}
            {t('values.collaboration.description')}
          </li>
        </ul>

        <h2>{t('team.title')}</h2>
        <p>{t('team.description')}</p>
      </div>
    </div>
  )
}
