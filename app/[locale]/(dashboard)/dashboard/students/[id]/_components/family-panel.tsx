import { Card } from '@peaklab/ui'
import { ChevronRight, Mail, Phone } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import type { Family, FamilyPerson, Person, PhoneNumber } from '@/generated/prisma/client'
import { Link } from '@/i18n/routing'

type FamilyWithMembers = Family & {
  persons: Array<
    FamilyPerson & {
      person: Person & { phoneNumbers: PhoneNumber[] }
    }
  >
}

type Props = {
  family: FamilyWithMembers | null
}

export async function FamilyPanel({ family }: Props) {
  const t = await getTranslations('dashboard.pages.studentDetails')
  const tRelation = await getTranslations('dashboard.pages.familyDetails.relationType')

  if (!family) {
    return (
      <Card className="p-4">
        <h2 className="text-sm font-semibold text-gray-900">{t('family')}</h2>
        <p className="mt-2 text-sm text-gray-500">{t('familyPanel.none')}</p>
      </Card>
    )
  }

  const contacts = family.persons.filter((p) => ['PARENT', 'TUTOR'].includes(p.relationType))

  return (
    <Card className="overflow-hidden p-0">
      <Link
        href={`/dashboard/families/${family.id}`}
        className="group flex items-center justify-between gap-3 border-b border-gray-100 p-4 transition-colors hover:bg-gray-50/70"
      >
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{t('family')}</p>
          <p className="mt-0.5 truncate font-medium text-gray-900">{family.name}</p>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-gray-300 transition-colors group-hover:text-primary" />
      </Link>

      <div className="p-4">
        <h3 className="text-xs font-medium uppercase tracking-wide text-gray-500">
          {t('familyPanel.contacts')}
        </h3>
        {contacts.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">{t('familyPanel.noContacts')}</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {contacts.map((contact) => (
              <li key={contact.personId} className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-medium text-blue-900">
                  {contact.person.name.charAt(0)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {contact.person.name} {contact.person.lastname}
                  </p>
                  <p className="text-xs text-gray-500">{tRelation(contact.relationType)}</p>
                  <div className="mt-1 space-y-0.5">
                    {contact.person.phoneNumbers[0] && (
                      <a
                        href={`tel:${contact.person.phoneNumbers[0].phoneNumber}`}
                        className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-primary hover:underline"
                      >
                        <Phone className="h-3.5 w-3.5 text-gray-400" />
                        {contact.person.phoneNumbers[0].phoneNumber}
                      </a>
                    )}
                    {contact.person.email && (
                      <a
                        href={`mailto:${contact.person.email}`}
                        className="flex items-center gap-1.5 truncate text-xs text-gray-600 hover:text-primary hover:underline"
                      >
                        <Mail className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                        <span className="truncate">{contact.person.email}</span>
                      </a>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  )
}
