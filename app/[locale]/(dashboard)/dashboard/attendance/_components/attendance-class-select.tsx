'use client'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@peaklab/ui'
import { useRouter } from '@/i18n/routing'
import { type AttendancePeriodQuery, attendancePeriodHref } from './attendance-period-href'

export function AttendanceClassSelect({
  query,
  items,
  label,
}: {
  query: AttendancePeriodQuery
  items: { value: string; label: string }[]
  label: string
}) {
  const router = useRouter()
  return (
    <Select
      name="classId"
      items={items}
      defaultValue={query.classId}
      onValueChange={(value) => {
        if (typeof value === 'string' && value !== query.classId)
          router.push(attendancePeriodHref({ ...query, classId: value }))
      }}
    >
      <SelectTrigger
        aria-label={label}
        className="min-h-11 w-auto min-w-40 border-alabaster-600 font-semibold"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
