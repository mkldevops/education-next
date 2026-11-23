import { Button } from '@peaklab/ui'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { ComponentProps } from 'react'
import type { Labels } from './attendance-call-model'
import styles from './attendance-panel.module.css'
import { StudentAttendanceCard } from './student-attendance-card'

export function StudentStepper({
  card,
  labels,
  index,
  total,
  forward,
  globalPending,
  onMove,
}: {
  card: Omit<ComponentProps<typeof StudentAttendanceCard>, 'labels' | 'globalPending' | 'footer'>
  labels: Labels
  index: number
  total: number
  forward: boolean
  globalPending: boolean
  onMove: (next: number) => void
}) {
  const position = labels.studentPosition
    .replace('{current}', String(index + 1))
    .replace('{total}', String(total))
  return (
    <section aria-label={position} className="mx-auto max-w-2xl">
      <div key={card.entry.id} className={forward ? styles.enterForward : styles.enterBack}>
        <StudentAttendanceCard
          {...card}
          labels={labels}
          globalPending={globalPending}
          footer={
            <div className="grid grid-cols-2 items-center gap-1.5 sm:grid-cols-[1fr_auto_1fr] sm:gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="row-start-2 col-start-1 min-h-11 justify-self-start px-1.5 sm:row-start-1"
                aria-label={labels.previousStudent}
                disabled={index === 0 || globalPending}
                onClick={() => onMove(index - 1)}
              >
                <ChevronLeft aria-hidden="true" />
                <span>{labels.previous}</span>
              </Button>
              <span className="row-start-1 col-span-2 col-start-1 text-center text-xs font-medium text-graphite-600 sm:col-span-1 sm:col-start-2 sm:row-start-1">
                {position}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="row-start-2 col-start-2 min-h-11 justify-self-end px-1.5 sm:row-start-1 sm:col-start-3"
                aria-label={labels.nextStudent}
                disabled={index === total - 1 || globalPending}
                onClick={() => onMove(index + 1)}
              >
                <span>{labels.next}</span>
                <ChevronRight aria-hidden="true" />
              </Button>
            </div>
          }
        />
      </div>
    </section>
  )
}
