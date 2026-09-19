export type FamilyAction =
  | 'addEnrollment'
  | 'addPayment'
  | 'addStudent'
  | 'editFamily'
  | 'archiveFamily'
  | 'deleteFamily'

export function familyActionHref(
  familyId: string,
  action: FamilyAction,
  extra: Record<string, string> = {}
) {
  return `/dashboard/families/${familyId}?${new URLSearchParams({ action, ...extra })}`
}
