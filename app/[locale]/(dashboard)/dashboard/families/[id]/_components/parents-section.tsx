import type { FamilyPerson, Person, PhoneNumber } from '@prisma/client'
import { getTranslations } from 'next-intl/server'

type PersonWithRelation = FamilyPerson & {
  person: Person & {
    phoneNumbers: PhoneNumber[]
  }
}

type Props = {
  persons: PersonWithRelation[]
}

export async function ParentsSection({ persons }: Props) {
  const tCommon = await getTranslations('common')
  const t = await getTranslations('dashboard.pages.familyDetails')

  const parents = persons.filter((p) => ['PARENT', 'TUTOR'].includes(p.relationType))

  if (parents.length === 0) {
    return (
      <div className="text-center py-8 text-gray-600">
        <p className="text-sm">{tCommon('noResults')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {parents.map((parent) => (
        <div key={parent.personId} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-lg flex-shrink-0">
              {parent.person.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">
                {parent.person.name} {parent.person.lastname}
              </p>
              <p className="text-xs text-gray-600 mt-0.5">
                {t(`relationType.${parent.relationType}`)}
              </p>
              {parent.person.phoneNumbers.length > 0 && (
                <p className="text-xs text-gray-600 mt-1">
                  {parent.person.phoneNumbers[0].phoneNumber}
                </p>
              )}
              {parent.person.email && (
                <p className="text-xs text-gray-600 mt-0.5 truncate">{parent.person.email}</p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
