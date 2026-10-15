type LayoutSlot = {
  weekday: number
  startTime: string
  endTime: string
  description: string | null
  classPeriod: { level: { name: string } }
  teachers: Array<{ teacher: { firstName: string; lastName: string } }>
}

export type PrintOrientation = 'portrait' | 'landscape'

export const PRINT_PAGES = {
  portrait: { widthMm: 186, heightMm: 271 },
  landscape: { widthMm: 273, heightMm: 184 },
} satisfies Record<PrintOrientation, { widthMm: number; heightMm: number }>

const PRINT_CHROME_MM = { height: 70, width: 22 }
const PRINT_MAX_FONT_MM = 5.3
const PRINT_BLOCK_EM = 2.6
const PRINT_ITEM_EM = { compact: 2.1, focused: 4, description: 4 }
const CHAR_EM = 0.55
const CHIP_CHROME_EM = 2.5
const MISSING_TEACHER_CHARS = 22
const LABEL_EM = { min: 8, max: 20 }

export function toMinutes(time: string) {
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))
}

export function groupByTimeRange<T extends LayoutSlot>(slots: T[]) {
  const groups: { key: string; startTime: string; endTime: string; slots: T[] }[] = []
  for (const slot of slots) {
    const key = `${slot.startTime}-${slot.endTime}`
    const group = groups.find((candidate) => candidate.key === key)
    if (group) group.slots.push(slot)
    else groups.push({ key, startTime: slot.startTime, endTime: slot.endTime, slots: [slot] })
  }
  return groups.sort((a, b) => a.startTime.localeCompare(b.startTime))
}

type Range = { startTime: string; endTime: string; slots: LayoutSlot[] }

export function assignLanes<T extends Range>(ranges: T[]) {
  const laneEnds: number[] = []
  const placed = ranges.map((range) => {
    const start = toMinutes(range.startTime)
    let lane = laneEnds.findIndex((end) => end <= start)
    if (lane === -1) lane = laneEnds.length
    laneEnds[lane] = toMinutes(range.endTime)
    return { range, lane }
  })
  return { placed, laneCount: Math.max(laneEnds.length, 1) }
}

export function axisBounds(ranges: Range[]) {
  return {
    start: Math.floor(Math.min(...ranges.map((range) => toMinutes(range.startTime))) / 60) * 60,
    end: Math.ceil(Math.max(...ranges.map((range) => toMinutes(range.endTime))) / 60) * 60,
  }
}

export function printMinutesPerEm(ranges: Range[], focused: boolean) {
  return ranges.reduce((min, range) => {
    const lines = range.slots.reduce(
      (sum, slot) =>
        sum +
        (focused
          ? PRINT_ITEM_EM.focused + (slot.description ? PRINT_ITEM_EM.description : 0)
          : PRINT_ITEM_EM.compact),
      PRINT_BLOCK_EM
    )
    return Math.min(min, (toMinutes(range.endTime) - toMinutes(range.startTime)) / lines)
  }, Number.POSITIVE_INFINITY)
}

export function printLabelEm(slots: LayoutSlot[], focused: boolean) {
  const widest = slots.reduce((max, slot) => {
    const teachers = slot.teachers
      .map(({ teacher }) => `${teacher.firstName} ${teacher.lastName}`.trim())
      .join(', ')
    const teacherChars = teachers.length || MISSING_TEACHER_CHARS
    const level = slot.classPeriod.level.name.length
    return Math.max(max, focused ? Math.max(level, teacherChars + 2) : level + 1 + teacherChars)
  }, 0)
  return Math.min(Math.max(widest * CHAR_EM + CHIP_CHROME_EM, LABEL_EM.min), LABEL_EM.max)
}

export function choosePrintOrientation(slots: LayoutSlot[], focused: boolean): PrintOrientation {
  const weekdays = [...new Set(slots.map((slot) => slot.weekday))]
  const days = weekdays.map((weekday) =>
    groupByTimeRange(slots.filter((slot) => slot.weekday === weekday))
  )
  const ranges = days.flat()
  if (ranges.length === 0) return 'portrait'

  const axis = axisBounds(ranges)
  const minutesPerEm = printMinutesPerEm(ranges, focused)
  const lanes = Math.max(...days.map((day) => assignLanes(day).laneCount))
  const labelEm = printLabelEm(slots, focused)
  const fontMm = (orientation: PrintOrientation) => {
    const page = PRINT_PAGES[orientation]
    return Math.min(
      ((page.heightMm - PRINT_CHROME_MM.height) / (axis.end - axis.start)) * minutesPerEm,
      (page.widthMm - PRINT_CHROME_MM.width) / weekdays.length / (lanes * labelEm),
      PRINT_MAX_FONT_MM
    )
  }
  return fontMm('landscape') > fontMm('portrait') ? 'landscape' : 'portrait'
}
