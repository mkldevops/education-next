import { getTranslations } from 'next-intl/server'
import type { FamilyPerson, Person, PhoneNumber } from '@/generated/prisma/client'
import { AddPersonDialog } from '../../_components/add-person-dialog'
import { EditPersonDialog } from '../../_components/edit-person-dialog'
import { InviteParentButton } from '../../_components/invite-parent-button'

export type PersonWithRelation = FamilyPerson & {
  person: Person & {
    phoneNumbers: PhoneNumber[]
  }
}

type Props = {
  persons: PersonWithRelation[]
  familyId: string
  isAdmin: boolean
  linkedEmails: string[]
}

export async function ParentsSection({ persons, familyId, isAdmin, linkedEmails }: Props) {
  const tCommon = await getTranslations('common')
  const t = await getTranslations('dashboard.pages.familyDetails')

  const parents = persons.filter((p) => ['PARENT', 'TUTOR'].includes(p.relationType))

  return (
    <div className="space-y-4">
      {isAdmin && (
        <div className="flex justify-end">
          <AddPersonDialog familyId={familyId} />
        </div>
      )}

      {parents.length === 0 ? (
        <div className="py-8 text-center text-graphite-600">
          <p className="text-sm">{tCommon('noResults')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {parents.map((parent) => (
            <div
              key={parent.personId}
              className="rounded border border-alabaster-700 bg-alabaster-900 p-3"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-lg">
                    {parent.person.name.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-graphite">
                      {parent.person.name} {parent.person.lastname}
                    </p>
                    <p className="mt-0.5 text-xs text-graphite-600">
                      {t(`relationType.${parent.relationType}`)}
                    </p>
                    {parent.person.phoneNumbers.length > 0 && (
                      <p className="mt-1 text-xs text-graphite-600">
                        {parent.person.phoneNumbers[0].phoneNumber}
                      </p>
                    )}
                    {parent.person.email && (
                      <p className="mt-0.5 truncate text-xs text-graphite-600">
                        {parent.person.email}
                      </p>
                    )}
                    {parent.person.address && (
                      <p className="mt-0.5 truncate text-xs text-graphite-600">
                        {[
                          parent.person.address,
                          [parent.person.postCode, parent.person.city].filter(Boolean).join(' '),
                        ]
                          .filter(Boolean)
                          .join(', ')}
                      </p>
                    )}
                  </div>
                </div>
                {isAdmin && (
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <EditPersonDialog
                      familyId={familyId}
                      person={{
                        id: parent.personId,
                        name: parent.person.name,
                        lastname: parent.person.lastname,
                        sex: parent.person.sex,
                        email: parent.person.email,
                        address: parent.person.address,
                        postCode: parent.person.postCode,
                        city: parent.person.city,
                        relationType: parent.relationType,
                        phoneNumber: parent.person.phoneNumbers[0]?.phoneNumber ?? null,
                      }}
                    />
                    {parent.person.email &&
                      (linkedEmails.some(
                        (email) => email.toLowerCase() === parent.person.email?.toLowerCase()
                      ) ? (
                        <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800">
                          {t('portalInvitation.active')}
                        </span>
                      ) : (
                        <InviteParentButton
                          familyId={familyId}
                          personId={parent.personId}
                          email={parent.person.email}
                        />
                      ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
