import { Breadcrumbs, Tabs } from '@peaklab/ui'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { getSelectedPeriodId } from '@/features/dashboard/period'
import { enrollmentGateway } from '@/gateways/enrollment-gateway'
import { familyGateway } from '@/gateways/family-gateway'
import { hasActiveSchoolStaffAccess, isActiveSchoolAdmin } from '@/lib/school-context'
import { getSchoolRegionalSettings } from '@/lib/school-regional-settings'
import { isPaymentsEnabled } from '@/use-cases/config/is-payments-enabled'
import { getFamilyBalance } from '@/use-cases/payments/family-balance'
import { getFamilyPaymentTracking } from '@/use-cases/payments/payment-tracking'
import { isOnlinePaymentAvailable } from '@/use-cases/payments/stripe-settings'
import { SchoolSwitchPrompt } from '../../../_components/school-switch-prompt'
import { requireSchoolSession } from '../../../_lib/auth-helper'
import { classLabel } from '../../../_lib/class-options'
import { loadSuggestedLevels, toClassOption } from '../../../_lib/class-options-loader'
import { deepLinkTitle } from '../../../_lib/page-metadata'
import { canSwitchSchool } from '../../../_lib/school-switch'
import { CreateEnrollmentDialog } from '../../enrollments/_components/create-enrollment-dialog'
import { RecordPaymentDialog } from '../../payments/_components/record-payment-dialog'
import { CreateStudentDialog } from '../../students/_components/create-student-dialog'
import { DeactivateFamilyButton } from '../_components/deactivate-family-button'
import { DeleteFamilyDialog } from '../_components/delete-family-dialog'
import { EditFamilyDialog } from '../_components/edit-family-dialog'
import { MergeFamilyDialog } from '../_components/merge-family-dialog'
import { ActivityTab } from './_components/activity-tab'
import { ChildrenTab } from './_components/children-tab'
import { HeroBanner } from './_components/hero-banner'
import { OverviewTab } from './_components/overview-tab'
import { PaymentsTab } from './_components/payments-tab'
import type { FamilyAction } from './_lib/family-action-href'
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
  const openAction = action as FamilyAction | undefined
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
  // Un enseignant à accès élargi gère la famille sans en voir l'argent.
  const isStaff = await hasActiveSchoolStaffAccess(context)
  const seesFinances = isAdmin || !isStaff
  const paymentsEnabled = seesFinances && (await isPaymentsEnabled(family.schoolId))
  const tabKeys: TabKey[] = paymentsEnabled
    ? ['overview', 'children', 'payments', 'activity']
    : ['overview', 'children', 'activity']

  // `countDeletionImpact` n'est pas dérivable de `family` : la page lit par `db`, filtrée
  // sur `isActive`, alors que la suppression emporte aussi les lignes archivées.
  // Le bouton de paiement en ligne n'est rendu que pour un parent.
  const [
    selectedPeriodId,
    familyBalance,
    deletionImpact,
    onlinePaymentAvailable,
    { currency },
    paymentTracking,
  ] = await Promise.all([
    getSelectedPeriodId(family.schoolId),
    seesFinances ? getFamilyBalance(family.schoolId, family.id) : null,
    isAdmin ? familyGateway.countDeletionImpact(family.schoolId, family.id) : null,
    isStaff ? false : isOnlinePaymentAvailable(family.schoolId),
    getSchoolRegionalSettings(family.schoolId),
    paymentsEnabled ? getFamilyPaymentTracking(family.schoolId, family.id) : null,
  ])

  const mergeOptions = isAdmin ? await familyGateway.list(family.schoolId) : []

  const {
    students,
    allEnrollments,
    enrolledChildren,
    activeEnrollments,
    pendingCount,
    scopedStudentId,
  } = deriveFamilyDetail(family, studentId)
  const { totalAmount, totalDiscount, totalPaid, remainingBalance } = familyBalance ?? {
    totalAmount: 0,
    totalDiscount: 0,
    totalPaid: 0,
    remainingBalance: 0,
  }
  const payments = seesFinances ? serializeFamilyPayments(family.payments) : []

  /* Le bouton « Inscrire » de la carte enfant se juge sur les mêmes données que
     `createEnrollment`, jamais sur les affectations affichées : celles-ci sont filtrées sur
     `endAt: null` et masqueraient l'inscription d'un élève réaffecté vers une autre période.

     Sans période sélectionnée — une école sans aucune période active — il n'y a pas de cible :
     `getFamilyDialogData` ne rend alors aucune classe, le dialogue est insoumettable et le
     bouton inerte. Ne pas élargir cette branche en « tout le monde peut s'inscrire ». */
  const studentIds = students.map((s) => s.person.student.id)
  const [{ plans, classes }, studentsEnrolledInSelectedPeriod, suggestedLevels] = await Promise.all(
    [
      getFamilyDialogData(family.schoolId, isStaff, selectedPeriodId),
      isStaff && selectedPeriodId !== null
        ? enrollmentGateway.findStudentIdsEnrolledInPeriod(
            family.schoolId,
            studentIds,
            selectedPeriodId
          )
        : new Set<string>(),
      isStaff
        ? loadSuggestedLevels(family.schoolId, studentIds, selectedPeriodId)
        : new Map<string, string>(),
    ]
  )

  const classOptions = classes.map((c) => toClassOption(c))
  // « Changer de classe » liste les classes sans titre de niveau : il garde le libellé complet.
  const reassignClassOptions = classOptions.map((c) => ({ id: c.id, name: classLabel(c) }))
  const planOptions = (isAdmin ? plans : []).map((p) => ({
    id: p.id,
    name: p.name,
    amount: Number(p.amount),
  }))
  const familyHref = `/dashboard/families/${family.id}`

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
        showActions={isStaff}
        canDelete={isAdmin}
      >
        {isStaff && (
          <>
            <CreateEnrollmentDialog
              students={students.map((s) => ({
                id: s.person.student.id,
                name: `${s.person.lastname} ${s.person.name}`,
                suggestedLevelId: suggestedLevels.get(s.person.student.id) ?? null,
                enrolledInPeriod: studentsEnrolledInSelectedPeriod.has(s.person.student.id),
              }))}
              plans={planOptions}
              classes={classOptions}
              paymentsEnabled={paymentsEnabled}
              currency={currency}
              defaultOpen={openAction === 'addEnrollment'}
              defaultStudentId={scopedStudentId}
              redirectTo={familyHref}
              showTrigger={false}
            />
            {paymentsEnabled && (
              <RecordPaymentDialog
                families={[{ id: family.id, name: family.name }]}
                remainingAmount={remainingBalance}
                currency={currency}
                defaultOpen={openAction === 'addPayment'}
                redirectTo={familyHref}
                showTrigger={false}
              />
            )}
            <CreateStudentDialog
              familyId={family.id}
              familyName={family.name}
              plans={planOptions}
              classes={classOptions}
              paymentsEnabled={paymentsEnabled}
              currency={currency}
              defaultOpen={openAction === 'addStudent'}
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
              defaultOpen={openAction === 'editFamily'}
              redirectTo={familyHref}
              showTrigger={false}
            />
            <DeactivateFamilyButton
              familyId={family.id}
              defaultOpen={openAction === 'archiveFamily'}
              redirectTo={familyHref}
              showTrigger={false}
            />
            {isAdmin && (
              <MergeFamilyDialog
                familyId={family.id}
                familyName={family.name}
                families={mergeOptions
                  .filter((option) => option.id !== family.id)
                  .map(({ id, name }) => ({ id, name }))}
                cleanUrl={familyHref}
                defaultOpen={openAction === 'mergeFamily'}
              />
            )}
            {deletionImpact && (
              <DeleteFamilyDialog
                familyId={family.id}
                familyName={family.name}
                impact={deletionImpact}
                defaultOpen={openAction === 'deleteFamily'}
                redirectTo={familyHref}
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
        defaultIndex={Math.max(0, tabKeys.indexOf(tab as TabKey))}
        tabs={[
          {
            label: t('tabs.overview'),
            content: (
              <OverviewTab
                locale={locale}
                currency={currency}
                familyId={family.id}
                isAdmin={isStaff}
                canInvite={isAdmin}
                onlinePaymentAvailable={onlinePaymentAvailable}
                persons={family.persons}
                students={students}
                linkedEmails={family.users.map(({ user }) => user.email)}
                enrolledChildren={enrolledChildren}
                totalEnrollments={allEnrollments.length}
                activeEnrollments={activeEnrollments}
                canAddEnrollment={
                  isStaff &&
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
                pendingCount={pendingCount}
                locale={locale}
                currency={currency}
                familyId={family.id}
                isAdmin={isStaff}
                classes={reassignClassOptions}
                studentsEnrolledInSelectedPeriod={studentsEnrolledInSelectedPeriod}
                paymentsEnabled={paymentsEnabled}
              />
            ),
          },
          ...(paymentsEnabled
            ? [
                {
                  label: t('tabs.payments'),
                  content: (
                    <PaymentsTab
                      payments={payments}
                      locale={locale}
                      currency={currency}
                      tracking={paymentTracking}
                    />
                  ),
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
                currency={currency}
                paymentsEnabled={paymentsEnabled}
              />
            ),
          },
        ]}
      />
    </div>
  )
}
