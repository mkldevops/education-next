'use client'

import { useTranslations } from 'next-intl'
import { SchoolConfigKey } from '@/lib/school-config'
import { FlagToggle } from '../../../_components/flag-toggle'
import { setConfigAction } from '../../../_lib/config-actions'
import { type AbsenceReasonSetting, AbsenceReasonsOption } from './absence-reasons-option'
import { ModuleCard } from './module-card'
import { ConfigSelectRow, useConfigChoices } from './option-row'
import { type SchoolSetting, settingValue } from './school-setting'

type Props = {
  settings: SchoolSetting[]
  absenceReasons: AbsenceReasonSetting[]
  /** Notes de frais déjà saisies, que la coupure rendrait inatteignables. */
  teacherExpenseCount: number
}

async function saveFlag(name: SchoolConfigKey, enabled: boolean) {
  const result = await setConfigAction({ name, value: String(enabled) })
  return typeof result === 'string' ? result : 'OK'
}

/**
 * Une carte par module de l'école. Les options d'un module ne vivent que dans son dialogue,
 * sous son interrupteur : la page ne montre que ce qui est actif et ce qui reste à régler.
 *
 * `automatic_promotion` n'y figure pas : aucun traitement ne lit ce réglage.
 */
export function SchoolModulesGrid({ settings, absenceReasons, teacherExpenseCount }: Props) {
  const t = useTranslations('dashboard.pages.config')
  const value = (name: SchoolConfigKey) => settingValue(settings, name)
  const isOn = (name: SchoolConfigKey) => value(name) === 'true'
  const label = (name: SchoolConfigKey, choices: { value: string; label: string }[]) =>
    choices.find((choice) => choice.value === value(name))?.label ?? choices[0]?.label ?? ''

  const frequencies = useConfigChoices(SchoolConfigKey.AttendanceFrequency)
  const entryModes = useConfigChoices(SchoolConfigKey.AttendanceEntryMode)
  const visibilities = useConfigChoices(SchoolConfigKey.ClassScheduleVisibility)

  const moduleProps = (name: SchoolConfigKey) => ({
    title: t(`settings.${name}.label`),
    description: t(`settings.${name}.description`),
    enabled: isOn(name),
    onSave: (enabled: boolean) => saveFlag(name, enabled),
  })

  const optionToggle = (name: SchoolConfigKey) => (
    <FlagToggle key={`${name}:${value(name)}`} {...moduleProps(name)} />
  )

  const expensesKey = SchoolConfigKey.TeacherExpensesEnabled
  const confirmExpensesDisable =
    teacherExpenseCount > 0
      ? {
          title: t(`settings.${expensesKey}.confirmDisable.title`),
          description: t(`settings.${expensesKey}.confirmDisable.description`, {
            expenses: teacherExpenseCount,
          }),
          confirmLabel: t(`settings.${expensesKey}.confirmDisable.confirm`),
          cancelLabel: t(`settings.${expensesKey}.confirmDisable.cancel`),
        }
      : undefined

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ModuleCard
        {...moduleProps(SchoolConfigKey.AttendanceEnabled)}
        summary={[
          label(SchoolConfigKey.AttendanceFrequency, frequencies),
          label(SchoolConfigKey.AttendanceEntryMode, entryModes),
          t('modules.summary.reasons', { count: absenceReasons.length }),
        ].join(' · ')}
      >
        <ConfigSelectRow
          key={`frequency:${value(SchoolConfigKey.AttendanceFrequency)}`}
          name={SchoolConfigKey.AttendanceFrequency}
          value={value(SchoolConfigKey.AttendanceFrequency)}
        />
        <ConfigSelectRow
          key={`entry:${value(SchoolConfigKey.AttendanceEntryMode)}`}
          name={SchoolConfigKey.AttendanceEntryMode}
          value={value(SchoolConfigKey.AttendanceEntryMode)}
        />
        {optionToggle(SchoolConfigKey.AttendanceAbsenceReasonRequired)}
        <AbsenceReasonsOption reasons={absenceReasons} />
      </ModuleCard>

      <ModuleCard
        {...moduleProps(SchoolConfigKey.ClassScheduleEnabled)}
        summary={[
          label(SchoolConfigKey.ClassScheduleVisibility, visibilities),
          t(
            isOn(SchoolConfigKey.ClassScheduleTeacherOverlapAllowed)
              ? 'modules.summary.overlapAllowed'
              : 'modules.summary.overlapForbidden'
          ),
        ].join(' · ')}
      >
        <ConfigSelectRow
          key={`visibility:${value(SchoolConfigKey.ClassScheduleVisibility)}`}
          name={SchoolConfigKey.ClassScheduleVisibility}
          value={value(SchoolConfigKey.ClassScheduleVisibility)}
        />
        {optionToggle(SchoolConfigKey.ClassScheduleTeacherOverlapAllowed)}
      </ModuleCard>

      <ModuleCard {...moduleProps(SchoolConfigKey.MealsEnabled)} />
      <ModuleCard {...moduleProps(SchoolConfigKey.EventsEnabled)} />
      <ModuleCard {...moduleProps(expensesKey)} confirmDisable={confirmExpensesDisable} />
      <ModuleCard {...moduleProps(SchoolConfigKey.TeacherStaffAccessEnabled)} />
    </div>
  )
}
