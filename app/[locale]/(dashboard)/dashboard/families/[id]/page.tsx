import { Breadcrumbs, Tabs } from '@peaklab/ui'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { getSelectedPeriodId } from '@/features/dashboard/period'
import { enrollmentGateway } from '@/gateways/enrollment-gateway'
import { familyGateway } from '@/gateways/family-gateway'
import { isActiveSchoolAdmin } from '@/lib/school-context'
import { isPaymentsEnabled } from '@/use-cases/config/is-payments-enabled'
import { getFamilyBalance } from '@/use-cases/payments/family-balance'
import { SchoolSwitchPrompt } from '../../../_components/school-switch-prompt'
import { requireSchoolSession } from '../../../_lib/auth-helper'
import { deepLinkTitle } from '../../../_lib/page-metadata'
import { canSwitchSchool } from '../../../_lib/school-switch'
import { CreateEnrollmentDialog } from '../../enrollments/_components/create-enrollment-dialog'
import { RecordPaymentDialog } from '../../payments/_components/record-payment-dialog'
import { CreateStudentDialog } from '../../students/_components/create-student-dialog'
import { DeactivateFamilyButton } from '../_components/deactivate-family-button'
import { DeleteFamilyDialog } from '../_components/delete-family-dialog'
import { EditFamilyDialog } from '../_components/edit-family-dialog'
import { ActivityTab } from './_components/activity-tab'
import { ChildrenTab } from './_components/children-tab'
import { HeroBanner } from './_components/hero-banner'
import { OverviewTab } from './_components/overview-tab'
import { PaymentsTab } from './_components/payments-tab'
import {
  deriveFamilyDetail,
  getFamilyDialogData,
  resolveFamily,
  serializeFamilyPayments,
} from './_lib/family-detail'

type TabKey = 'overview' | 'children' | 'payments' | 'activity'

type Props = {
  params: Promise<{ locale: string; id: string }>
  searchParams: Promise<{ action?: string; studentId?: string; payment?: string; tab?: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, locale } = await params
  await requireSchoolSession()

  return deepLinkTitle(locale, await resolveFamily(id), (family) => family.name)
}

export default async function FamilyDetailPage({ params, searchParams }: Props) {
  await connection()
  const { locale, id } = await params
  const { action, studentId, payment, tab } = await searchParams
  setRequestLocale(locale)
  const t = await getTranslations('dashboard.pages.familyDetails')
  const tBreadcrumbs = await getTranslations('dashboard.breadcrumbs')

  const context = await requireSchoolSession()
  const resolution = await resolveFamily(id)

  if (resolution.status === 'notFound') notFound()
  if (resolution.status === 'otherSchool')
    return (
      <SchoolSwitchPrompt
        schoolId={resolution.school.id}
        schoolName={resolution.school.name}
        canSwitch={await canSwitchSchool()}
      />
    )

  const family = resolution.resource
  const isAdmin = isActiveSchoolAdmin(context)
  const paymentsEnabled = await isPaymentsEnabled(family.schoolId)
  const TAB_KEYS: TabKey[] = paymentsEnabled
    ? ['overview', 'children', 'payments', 'activity']
    : ['overview', 'children', 'activity']

  // `countDeletionImpact` n'est pas dérivable de `family` : la page lit par `db`, filtrée
  // sur `isActive`, alors que la suppression emporte aussi les lignes archivées.
  const [selectedPeriodId, familyBalance, deletionImpact] = await Promise.all([
    getSelectedPeriodId(family.schoolId),
    getFamilyBalance(family.schoolId, family.id),
    isAdmin ? familyGateway.countDeletionImpact(family.schoolId, family.id) : null,
  ])

  const {
    students,
    allEnrollments,
    enrolledChildren,
    activeEnrollments,
    pendingCount,
    scopedStudentId,
    totalAmount,
    totalDiscount,
    totalPaid,
    remainingBalance,
  } = deriveFamilyDetail(family, familyBalance, studentId)
  const payments = serializeFamilyPayments(family.payments)

  /* Le bouton « Inscrire » de la carte enfant se juge sur les mêmes données que
     `createEnrollment`, jamais sur les affectations affichées : celles-ci sont filtrées sur
     `endAt: null` et masqueraient l'inscription d'un élève réaffecté vers une autre période.

     Sans période sélectionnée — une école sans aucune période active — il n'y a pas de cible :
     `getFamilyDialogData` ne rend alors aucune classe, le dialogue est insoumettable et le
     bouton inerte. Ne pas élargir cette branche en « tout le monde peut s'inscrire ». */
  const [{ plans, classes }, studentsEnrolledInSelectedPeriod] = await Promise.all([
    getFamilyDialogData(family.schoolId, isAdmin, selectedPeriodId),
    isAdmin && selectedPeriodId !== null
      ? enrollmentGateway.findStudentIdsEnrolledInPeriod(
          family.schoolId,
          students.map((s) => s.person.student.id),
          selectedPeriodId
        )
      : new Set<string>(),
  ])

  const classOptions = classes.map((c) => ({
    id: c.id,
    name: `${c.name} (${c.level.name} — ${c.period.name})`,
  }))

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: tBreadcrumbs('dashboard'), href: '/dashboard', icon: 'home' },
          { label: tBreadcrumbs('families'), href: '/dashboard/families' },
          { label: family.name },
        ]}
      />

      <HeroBanner
        family={family}
        membersCount={family.persons.length}
        studentsCount={students.length}
        enrollmentsCount={allEnrollments.length}
        paymentsEnabled={paymentsEnabled}
        remainingBalance={remainingBalance}
        showActions={isAdmin}
      >
        {isAdmin && (
          <>
            <CreateEnrollmentDialog
              students={students.map((s) => ({
                id: s.person.student.id,
                name: `${s.person.lastname} ${s.person.name}`,
              }))}
              plans={plans.map((p) => ({ id: p.id, name: p.name, amount: Number(p.amount) }))}
              classes={classOptions}
              paymentsEnabled={paymentsEnabled}
              defaultOpen={action === 'addEnrollment'}
              defaultStudentId={scopedStudentId}
              redirectTo={`/dashboard/families/${family.id}`}
              showTrigger={false}
            />
            {paymentsEnabled && (
              <RecordPaymentDialog
                families={[{ id: family.id, name: family.name }]}
                remainingAmount={remainingBalance}
                defaultOpen={action === 'addPayment'}
                redirectTo={`/dashboard/families/${family.id}`}
                showTrigger={false}
              />
            )}
            <CreateStudentDialog
              familyId={family.id}
              plans={plans.map((p) => ({ id: p.id, name: p.name, amount: Number(p.amount) }))}
              classes={classOptions}
              paymentsEnabled={paymentsEnabled}
              defaultOpen={action === 'addStudent'}
              showTrigger={false}
            />
            <EditFamilyDialog
              family={{
                id: family.id,
                name: family.name,
                emergencyContactName: family.emergencyContactName,
                emergencyContactPhone: family.emergencyContactPhone,
                authorizedPickup: family.authorizedPickup,
                languagesAtHome: family.languagesAtHome,
              }}
              defaultOpen={action === 'editFamily'}
              redirectTo={`/dashboard/families/${family.id}`}
              showTrigger={false}
            />
            <DeactivateFamilyButton
              familyId={family.id}
              defaultOpen={action === 'archiveFamily'}
              redirectTo={`/dashboard/families/${family.id}`}
              showTrigger={false}
            />
            {deletionImpact && (
              <DeleteFamilyDialog
                familyId={family.id}
                familyName={family.name}
                impact={deletionImpact}
                defaultOpen={action === 'deleteFamily'}
                redirectTo={`/dashboard/families/${family.id}`}
                showTrigger={false}
              />
            )}
          </>
        )}
      </HeroBanner>

      {payment === 'success' && (
        <div className="rounded border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          {t('onlinePayment.returned')}
        </div>
      )}
      {payment === 'cancelled' && (
        <div className="rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {t('onlinePayment.cancelled')}
        </div>
      )}

      <Tabs
        defaultIndex={Math.max(0, TAB_KEYS.indexOf(tab as TabKey))}
        tabs={[
          {
            label: t('tabs.overview'),
            content: (
              <OverviewTab
                locale={locale}
                familyId={family.id}
                isAdmin={isAdmin}
                persons={family.persons}
                linkedEmails={family.users.map(({ user }) => user.email)}
                enrolledChildren={enrolledChildren}
                totalEnrollments={allEnrollments.length}
                activeEnrollments={activeEnrollments}
                canAddEnrollment={
                  isAdmin &&
                  classOptions.length > 0 &&
                  (!paymentsEnabled || plans.length > 0) &&
                  students.some(
                    ({ person }) => !studentsEnrolledInSelectedPeriod.has(person.student.id)
                  )
                }
                paymentsEnabled={paymentsEnabled}
                totalPaid={totalPaid}
                remainingBalance={remainingBalance}
                totalDue={totalAmount}
                totalDiscount={totalDiscount}
              />
            ),
          },
          {
            label: t('tabs.children'),
            content: (
              <ChildrenTab
                students={students}
                hasPendingEnrollments={pendingCount > 0}
                pendingCount={pendingCount}
                locale={locale}
                familyId={family.id}
                isAdmin={isAdmin}
                classes={classOptions}
                studentsEnrolledInSelectedPeriod={studentsEnrolledInSelectedPeriod}
                paymentsEnabled={paymentsEnabled}
              />
            ),
          },
          ...(paymentsEnabled
            ? [
                {
                  label: t('tabs.payments'),
                  content: <PaymentsTab payments={payments} locale={locale} />,
                },
              ]
            : []),
          {
            label: t('tabs.activity'),
            content: (
              <ActivityTab
                enrollments={allEnrollments}
                payments={payments}
                locale={locale}
                paymentsEnabled={paymentsEnabled}
              />
            ),
          },
        ]}
      />
    </div>
  )
}
