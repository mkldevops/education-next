import type { Metadata } from 'next'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'

type Props = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'pages.privacy' })

  return {
    title: t('title'),
    description: t('description'),
  }
}

export default async function PrivacyPolicyPage({ params }: Props) {
  await connection()
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('pages.privacy')

  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="display-lg text-gray-900">{t('title')}</h1>

      <div className="mt-12 prose prose-gray max-w-none">
        <p>Dernière mise à jour : {new Date().toLocaleDateString(locale)}</p>

        <h2>1. Collecte des données</h2>
        <p>
          Nous collectons uniquement les données nécessaires au bon fonctionnement de nos services.
          Ces données peuvent inclure votre nom, adresse email, et les informations que vous nous
          fournissez volontairement via nos formulaires.
        </p>

        <h2>2. Utilisation des données</h2>
        <p>Vos données personnelles sont utilisées pour :</p>
        <ul>
          <li>Répondre à vos demandes de contact</li>
          <li>Améliorer nos services</li>
          <li>Vous envoyer des communications si vous y avez consenti</li>
        </ul>

        <h2>3. Protection des données</h2>
        <p>
          Nous mettons en œuvre des mesures de sécurité appropriées pour protéger vos données
          personnelles contre tout accès non autorisé, modification, divulgation ou destruction.
        </p>

        <h2>4. Vos droits</h2>
        <p>Conformément au RGPD, vous disposez des droits suivants :</p>
        <ul>
          <li>Droit d&apos;accès à vos données</li>
          <li>Droit de rectification</li>
          <li>Droit à l&apos;effacement</li>
          <li>Droit à la portabilité</li>
          <li>Droit d&apos;opposition</li>
        </ul>

        <h2>5. Contact</h2>
        <p>
          Pour toute question concernant cette politique de confidentialité, vous pouvez nous
          contacter via notre formulaire de contact.
        </p>
      </div>
    </div>
  )
}
