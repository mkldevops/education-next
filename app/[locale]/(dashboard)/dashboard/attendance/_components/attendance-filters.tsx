'use client'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@peaklab/ui'
import type { ReactNode } from 'react'
import { useRouter } from '@/i18n/routing'

type FilterItem = { value: string | null; label: string }

type Filters = { date: string; classId: string | null; teacherId: string | null }

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function filtersHref({ date, classId, teacherId }: Filters) {
  const params = new URLSearchParams({ date })
  if (classId) params.set('classId', classId)
  if (teacherId) params.set('teacherId', teacherId)
  return `/dashboard/attendance?${params.toString()}`
}

// Chaque changement pousse une nouvelle URL : la page relit `searchParams` côté serveur, la
// liste reste donc sous le contrôle de la requête Prisma et l'URL reste partageable.
export function AttendanceFilters({
  date,
  classId,
  teacherId,
  classItems,
  teacherItems,
  labels,
  children,
}: Filters & {
  classItems: FilterItem[]
  teacherItems: FilterItem[]
  labels: { date: string; class: string; teacher: string }
  children?: ReactNode
}) {
  const router = useRouter()
  const apply = (changes: Partial<Filters>) =>
    router.push(filtersHref({ date, classId, teacherId, ...changes }))

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
      <label className="grid gap-1 text-sm font-medium text-graphite">
        {labels.date}
        <input
          className="h-10 rounded border border-alabaster-600 bg-white px-3 text-sm"
          type="date"
          name="date"
          defaultValue={date}
          onChange={(event) => {
            const value = event.target.value
            if (DATE_PATTERN.test(value) && value !== date) apply({ date: value })
          }}
        />
      </label>
      <div className="grid gap-1 text-sm font-medium text-graphite">
        <label htmlFor="attendance-class">{labels.class}</label>
        <Select
          name="classId"
          items={classItems}
          defaultValue={classId}
          onValueChange={(value) => apply({ classId: value ?? null })}
        >
          <SelectTrigger id="attendance-class" className="border-alabaster-600">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {classItems.map((item) => (
              <SelectItem key={item.value ?? ''} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1 text-sm font-medium text-graphite">
        <label htmlFor="attendance-teacher">{labels.teacher}</label>
        <Select
          name="teacherId"
          items={teacherItems}
          defaultValue={teacherId}
          onValueChange={(value) => apply({ teacherId: value ?? null })}
        >
          <SelectTrigger id="attendance-teacher" className="border-alabaster-600">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {teacherItems.map((item) => (
              <SelectItem key={item.value ?? ''} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  )
}
