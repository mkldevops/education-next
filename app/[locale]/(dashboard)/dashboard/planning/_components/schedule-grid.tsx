import { Card } from '@peaklab/ui'
import { ChevronDown } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'
import { parseSimpleInline, type SimpleInlineNode } from '@/domain/simple-rich-text'
import { DeleteScheduleSlotDialog } from './delete-schedule-slot-dialog'
import { ScheduleSlotDialog } from './schedule-slot-dialog'

type Slot = {
  id: string
  classPeriodId?: string
  weekday: number
  startTime: string
  endTime: string
  description: string | null
  classPeriod: { id: string; name: string }
  teachers: Array<{ teacher: { id: string; firstName: string; lastName: string } }>
}

type Props = {
  slots: Slot[]
  weekdayLabels: Record<number, string>
  noTeachersLabel: string
  contentLabel: string
  durationUnits: { hours: string; minutes: string }
  classes: ComponentProps<typeof ScheduleSlotDialog>['classes']
  teachersByClass: ComponentProps<typeof ScheduleSlotDialog>['teachersByClass']
  isAdmin: boolean
}

export function ScheduleGrid({
  slots,
  weekdayLabels,
  noTeachersLabel,
  contentLabel,
  durationUnits,
  classes,
  teachersByClass,
  isAdmin,
}: Props) {
  const weekdays = Array.from(new Set(slots.map((slot) => slot.weekday))).sort((a, b) => a - b)

  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {weekdays.map((weekday) => {
        const daySlots = slots.filter((slot) => slot.weekday === weekday)
        return (
          <Card
            key={weekday}
            className="overflow-hidden rounded-xl border border-alabaster-700 p-0 shadow-sm"
          >
            <div className="flex items-center justify-between border-b border-alabaster-700 bg-alabaster-900 px-5 py-4">
              <h2 className="text-sm font-semibold capitalize text-graphite">
                {weekdayLabels[weekday]}
              </h2>
              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-graphite-600 shadow-sm">
                {daySlots.length}
              </span>
            </div>
            <ul className="space-y-3 bg-white p-3">
              {daySlots.map((slot) => {
                const teacherNames = slot.teachers
                  .map(({ teacher }) => `${teacher.lastName} ${teacher.firstName}`)
                  .join(', ')
                const duration = formatDuration(slot.startTime, slot.endTime, durationUnits)
                return (
                  <li
                    key={slot.id}
                    className="rounded-lg border border-alabaster-700 bg-background p-4 transition-shadow hover:shadow-sm"
                  >
                    <div className="flex items-start gap-3">
                      <p className="shrink-0 rounded-md bg-primary/10 px-2.5 py-1.5 font-mono text-xs font-semibold text-primary">
                        {slot.startTime}–{slot.endTime}
                      </p>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-graphite">{slot.classPeriod.name}</p>
                        <p className="mt-1 truncate text-sm text-graphite-600">
                          {teacherNames || noTeachersLabel}
                        </p>
                        <p className="mt-2 text-xs font-medium text-graphite-500">{duration}</p>
                      </div>
                    </div>
                    {slot.description && (
                      <details className="group mt-2">
                        <summary
                          aria-label={contentLabel}
                          className="flex cursor-pointer list-none items-center gap-2 py-1 text-graphite-500 marker:hidden hover:text-primary"
                        >
                          <span aria-hidden="true" className="h-px flex-1 bg-alabaster-700" />
                          <ChevronDown className="h-3.5 w-3.5 shrink-0 transition-transform group-open:rotate-180" />
                        </summary>
                        <RichDescription value={slot.description} />
                      </details>
                    )}
                    {isAdmin && (
                      <div className="mt-4 flex justify-end gap-2 border-t border-alabaster-700 pt-3">
                        <ScheduleSlotDialog
                          classes={classes}
                          teachersByClass={teachersByClass}
                          slot={{
                            id: slot.id,
                            classPeriodId: slot.classPeriodId ?? slot.classPeriod.id,
                            weekday: slot.weekday,
                            startTime: slot.startTime,
                            endTime: slot.endTime,
                            description: slot.description,
                            teacherIds: slot.teachers.map(({ teacher }) => teacher.id),
                          }}
                        />
                        <DeleteScheduleSlotDialog slotId={slot.id} />
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </Card>
        )
      })}
    </div>
  )
}

function RichDescription({ value }: { value: string }) {
  const nodes: ReactNode[] = []
  let bulletLines: string[] = []

  const flushBullets = () => {
    if (bulletLines.length === 0) return
    let bulletKey = 0
    nodes.push(
      <ul key={`list-${nodes.length}`} className="list-disc space-y-1 pl-5">
        {bulletLines.map((line) => {
          bulletKey += 1
          return <li key={`bullet-${bulletKey}-${line}`}>{renderInlineFormatting(line)}</li>
        })}
      </ul>
    )
    bulletLines = []
  }

  for (const [index, line] of value.split('\n').entries()) {
    if (line.startsWith('- ')) {
      bulletLines.push(line.slice(2))
      continue
    }
    flushBullets()
    nodes.push(
      line ? (
        <p key={`line-${index}`}>{renderInlineFormatting(line)}</p>
      ) : (
        <div key={`line-${index}`} className="h-2" />
      )
    )
  }
  flushBullets()

  return (
    <div className="mt-3 space-y-2 rounded-md bg-white/70 p-3 text-sm leading-relaxed text-graphite-600">
      {nodes}
    </div>
  )
}

function renderInlineFormatting(value: string): ReactNode[] {
  return renderInlineNodes(parseSimpleInline(value))
}

function renderInlineNodes(nodes: SimpleInlineNode[]): ReactNode[] {
  return nodes.map((node, index) => {
    const key = `${node.type}-${index}`
    if (node.type === 'strong') {
      return <strong key={key}>{renderInlineNodes(node.children)}</strong>
    }
    if (node.type === 'emphasis') {
      return <em key={key}>{renderInlineNodes(node.children)}</em>
    }
    return node.value
  })
}

function formatDuration(
  startTime: string,
  endTime: string,
  { hours, minutes }: Props['durationUnits']
) {
  const [startHours, startMinutes] = startTime.split(':').map(Number)
  const [endHours, endMinutes] = endTime.split(':').map(Number)
  const totalMinutes = endHours * 60 + endMinutes - (startHours * 60 + startMinutes)
  if (totalMinutes <= 0) return ''

  const fullHours = Math.floor(totalMinutes / 60)
  const remainingMinutes = totalMinutes % 60
  return [
    fullHours > 0 ? `${fullHours} ${hours}` : null,
    remainingMinutes > 0 ? `${remainingMinutes} ${minutes}` : null,
  ]
    .filter(Boolean)
    .join(' ')
}
