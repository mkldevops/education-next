import type { SchoolRole } from '@/types/enums'

export const ROLE_COLORS: Record<SchoolRole, 'blue' | 'green' | 'amber'> = {
  ADMIN: 'blue',
  PARENT: 'green',
  TEACHER: 'green',
  CASHIER: 'amber',
}
