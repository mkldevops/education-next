import type { ModelMessage } from 'ai'
import { z } from 'zod'

export const LOAD_TOOLS = 'load_tools'

/**
 * Outils toujours exposés : les lectures qui résolvent un libellé (élève, famille, classe,
 * formule, période) et servent presque à chaque tour. Le reste du catalogue attend que
 * le modèle charge son groupe, pour ne pas envoyer ~25 000 jetons de définitions à
 * chaque étape.
 */
export const CORE_TOOLS = [
  'describe_school',
  'find_students',
  'list_families',
  'list_levels',
  'list_periods',
  'list_plans',
  'list_class_periods',
  'list_teachers',
] as const

/** Un aperçu et son `commit_*` restent dans le même groupe : le commit forcé doit être actif. */
export const TOOL_GROUPS = {
  enrollments: {
    label: 'enroll a family, change, merge or split families, move or archive a student',
    tools: [
      'preview_enroll_family',
      'commit_enroll_family',
      'preview_update_enrollment',
      'commit_update_enrollment',
      'preview_merge_families',
      'commit_merge_families',
      'preview_split_family',
      'commit_split_family',
      'get_family_deletion_impact',
      'delete_family',
      'move_student_to_class',
      'archive_student',
    ],
  },
  payments: {
    label: 'tuition payments, receipts (incl. canteen and snack money), overdue, expense notes',
    tools: [
      'get_family_payments',
      'list_family_receipts',
      'list_overdue_students',
      'preview_record_payment',
      'commit_record_payment',
      'cancel_payments',
      'record_receipt',
      'cancel_receipt',
      'preview_record_teacher_expense',
      'commit_record_teacher_expense',
    ],
  },
  structure: {
    label: 'create or archive levels, plans, classes; create teachers and assign them',
    tools: [
      'create_level',
      'archive_level',
      'create_plan',
      'update_plan',
      'archive_plan',
      'create_class_period',
      'archive_class_period',
      'create_teacher',
      'assign_teacher_to_class',
    ],
  },
  schedule: {
    label: 'weekly class schedule, events, attendance calls (incl. adding new students to a call)',
    tools: [
      'list_class_schedule_slots',
      'create_class_schedule_slot',
      'update_class_schedule_slot',
      'delete_class_schedule_slot',
      'preview_class_schedule',
      'commit_class_schedule',
      'list_events',
      'get_event',
      'create_event',
      'update_event',
      'duplicate_event',
      'list_attendance_calls',
      'refresh_attendance_roster',
    ],
  },
  meals: {
    label: 'canteen and snack: settings, prices, subscriptions, absences, debtors, staff meals',
    tools: [
      'get_meal_settings',
      'set_meal_service_setting',
      'set_meal_price',
      'remove_meal_price',
      'record_meal_opening',
      'get_student_meals',
      'subscribe_meal',
      'change_meal_schedule',
      'stop_meal',
      'toggle_meal_absence',
      'list_meal_debtors',
      'get_staff_meals',
      'list_staff_meal_subscriptions',
      'subscribe_staff_meal',
    ],
  },
  childcare: {
    label: 'childcare (garderie): openings, subscriptions, monthly billing',
    tools: [
      'record_childcare_opening',
      'get_student_childcare',
      'save_childcare_subscription',
      'bill_childcare_month',
      'cancel_childcare_charge',
    ],
  },
} as const

export type ToolGroup = keyof typeof TOOL_GROUPS

const GROUP_NAMES = Object.keys(TOOL_GROUPS) as [ToolGroup, ...ToolGroup[]]

const GROUP_OF = new Map<string, ToolGroup>(
  GROUP_NAMES.flatMap((group) => TOOL_GROUPS[group].tools.map((name) => [name, group] as const))
)

export const loadToolsSchema = z.object({ groups: z.array(z.enum(GROUP_NAMES)).min(1) })

/** Groupes dont au moins un outil existe pour cet appelant (paiements désactivés, etc.). */
export function availableGroups(toolNames: ReadonlySet<string>): ToolGroup[] {
  return GROUP_NAMES.filter((group) => TOOL_GROUPS[group].tools.some((n) => toolNames.has(n)))
}

export function describeGroups(groups: readonly ToolGroup[]) {
  return groups.map((group) => `${group}: ${TOOL_GROUPS[group].label}`).join('; ')
}

type ToolCallLike = { toolName: string; input?: unknown }

/**
 * Un `load_tools` charge ses groupes ; tout autre appel charge le groupe de son outil, même
 * refusé parce qu'inactif : le modèle qui nomme un outil non chargé l'obtient à l'étape
 * suivante au lieu de tourner en rond.
 */
function groupsOf(call: ToolCallLike): ToolGroup[] {
  if (call.toolName === LOAD_TOOLS) {
    const parsed = loadToolsSchema.safeParse(call.input)
    return parsed.success ? parsed.data.groups : []
  }
  const group = GROUP_OF.get(call.toolName)
  return group ? [group] : []
}

function historyToolCalls(messages: readonly ModelMessage[]): ToolCallLike[] {
  return messages.flatMap((message) =>
    message.role === 'assistant' && Array.isArray(message.content)
      ? message.content.flatMap((part) =>
          part.type === 'tool-call' ? [{ toolName: part.toolName, input: part.input }] : []
        )
      : []
  )
}

/** Groupes déjà chargés dans la conversation : un tour suivant les garde. */
export function loadedGroups(
  history: readonly ModelMessage[],
  steps: ReadonlyArray<{ toolCalls: ReadonlyArray<ToolCallLike> }> = []
): Set<ToolGroup> {
  const calls = [...historyToolCalls(history), ...steps.flatMap((step) => step.toolCalls)]
  return new Set(calls.flatMap(groupsOf))
}

export function activeToolsFor(
  groups: ReadonlySet<ToolGroup>,
  toolNames: ReadonlySet<string>
): string[] {
  const names: string[] = [...CORE_TOOLS, LOAD_TOOLS]
  for (const group of groups) names.push(...TOOL_GROUPS[group].tools)
  return names.filter((name) => toolNames.has(name))
}
