import type { SchoolRole } from '@/types/enums'

export const ROLE_COLORS: Record<SchoolRole, 'blue' | 'green'> = {
  ADMIN: 'blue',
  PARENT: 'green',
  TEACHER: 'green',
}
