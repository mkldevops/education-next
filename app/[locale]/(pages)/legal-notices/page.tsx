import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

type Props = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'pages.legal' })

  return {
    title: t('title'),
    description: t('description'),
  }
}

export default async function LegalNoticesPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('pages.legal')
  const company = await getTranslations('company')

  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="display-lg text-gray-900">{t('title')}</h1>

      <div className="mt-12 prose prose-gray max-w-none">
        <h2>{t('sections.publisher.title')}</h2>
        <p>
          {company('legalName')}
          <br />
          {company('address')}
          <br />
          {company('city')}
          <br />
          {t('sections.publisher.siret')}: {company('siret')}
        </p>

        <h2>{t('sections.director.title')}</h2>
        <p>{t('sections.director.content', { name: company('director') })}</p>

        <h2>{t('sections.host.title')}</h2>
        <p>
          {t('sections.host.intro')}
          <br />
          {company('host')}
          <br />
          {company('hostAddress')}
        </p>

        <h2>{t('sections.intellectual.title')}</h2>
        <p>{t('sections.intellectual.content')}</p>

        <h2>{t('sections.data.title')}</h2>
        <p>{t('sections.data.content')}</p>

        <h2>{t('sections.contact.title')}</h2>
        <p>{t('sections.contact.content')}</p>
      </div>
    </div>
  )
}
