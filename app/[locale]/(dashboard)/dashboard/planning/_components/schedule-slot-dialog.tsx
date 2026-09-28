'use client'

import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  MultiSelect,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@peaklab/ui'
import { Bold, Italic, List, Pencil, Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import { parseSimpleInline, type SimpleInlineNode } from '@/domain/simple-rich-text'
import { DialogFormActions, useDialogForm } from '@/features/forms'
import { toast } from '@/lib/toast'
import {
  createClassScheduleSlotAction,
  updateClassScheduleSlotAction,
} from '../../../_lib/class-schedule-actions'

const DESCRIPTION_MAX_LENGTH = 500 // mirrors .max(500) in src/use-cases/class-schedules/schemas.ts

type Option = { id: string; name: string }

type Slot = {
  id: string
  classPeriodId: string
  weekday: number
  startTime: string
  endTime: string
  description: string | null
  teacherIds: string[]
}

type Props = {
  classes: Option[]
  teachersByClass: Record<string, Option[]>
  slot?: Slot
}

export function ScheduleSlotDialog({ classes, teachersByClass, slot }: Props) {
  const t = useTranslations('dashboard.pages.planning.form')
  const isEdit = Boolean(slot)

  return (
    <Dialog>
      <DialogTrigger>
        <Button variant={isEdit ? 'ghost' : 'default'} size={isEdit ? 'sm' : 'default'}>
          {isEdit ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {isEdit ? t('editTrigger') : t('createTrigger')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? t('editTitle') : t('createTitle')}</DialogTitle>
        </DialogHeader>
        <ScheduleSlotForm classes={classes} teachersByClass={teachersByClass} slot={slot} />
      </DialogContent>
    </Dialog>
  )
}

function ScheduleSlotForm({ classes, teachersByClass, slot }: Props) {
  const t = useTranslations('dashboard.pages.planning')
  const tForm = useTranslations('dashboard.pages.planning.form')
  const { isPending, close, onSubmit } = useDialogForm(t)
  const defaultClassId = slot?.classPeriodId ?? classes[0]?.id ?? ''
  const [classPeriodId, setClassPeriodId] = useState(defaultClassId)
  const [description, setDescription] = useState(slot?.description ?? '')
  const descriptionRef = useRef<HTMLDivElement>(null)
  const teacherOptions = teachersByClass[classPeriodId] ?? []
  const classItems = classes.map((classPeriod) => ({
    value: classPeriod.id,
    label: classPeriod.name,
  }))
  const weekdayItems = Array.from({ length: 7 }, (_, index) => index + 1).map((weekday) => ({
    value: String(weekday),
    label: t(`weekdays.${weekday}`),
  }))

  useEffect(() => {
    const editor = descriptionRef.current
    if (editor) renderMarkdownIntoEditor(editor, slot?.description ?? '')
  }, [slot?.description])

  const applyFormatting = (command: 'bold' | 'italic' | 'insertUnorderedList') => {
    descriptionRef.current?.focus()
    document.execCommand(command)
    setDescription(serializeEditor(descriptionRef.current))
  }

  const handleSubmit = onSubmit(
    (formData) => {
      const data = {
        classPeriodId: formData.get('classPeriodId') as string,
        weekday: Number(formData.get('weekday')),
        startTime: formData.get('startTime') as string,
        endTime: formData.get('endTime') as string,
        description: formData.get('description') as string,
        teacherIds: formData.getAll('teacherIds').map(String),
      }
      return slot
        ? updateClassScheduleSlotAction({ ...data, id: slot.id })
        : createClassScheduleSlotAction(data)
    },
    {
      onSuccess: (result) => {
        if (typeof result === 'object' && 'warnings' in result && result.warnings.length > 0) {
          toast.warning(t('warnings.teacherOverlap'))
        }
      },
    }
  )

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="schedule-class">{tForm('class')}</Label>
            {slot && <input type="hidden" name="classPeriodId" value={defaultClassId} />}
            <Select
              name="classPeriodId"
              items={classItems}
              value={classPeriodId}
              required
              disabled={isPending || Boolean(slot)}
              onValueChange={(value) => setClassPeriodId(value ?? '')}
            >
              <SelectTrigger id="schedule-class">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {classItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="schedule-weekday">{tForm('weekday')}</Label>
              <Select
                name="weekday"
                items={weekdayItems}
                defaultValue={String(slot?.weekday ?? 1)}
                disabled={isPending}
              >
                <SelectTrigger id="schedule-weekday">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {weekdayItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="schedule-start">{tForm('startTime')}</Label>
              <Input
                id="schedule-start"
                name="startTime"
                type="time"
                defaultValue={slot?.startTime}
                required
                disabled={isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="schedule-end">{tForm('endTime')}</Label>
              <Input
                id="schedule-end"
                name="endTime"
                type="time"
                defaultValue={slot?.endTime}
                required
                disabled={isPending}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="schedule-teachers">{tForm('teachers')}</Label>
            <MultiSelect
              key={classPeriodId}
              id="schedule-teachers"
              name="teacherIds"
              options={teacherOptions}
              defaultValue={classPeriodId === slot?.classPeriodId ? slot.teacherIds : []}
              disabled={isPending}
              placeholder={tForm('teachersPlaceholder')}
              searchPlaceholder={tForm('teachersSearch')}
              emptyMessage={tForm('teachersEmpty')}
              noResultsMessage={tForm('teachersNoResults')}
              removeLabel={tForm('teachersRemove')}
            />
          </div>
          <div className="space-y-2">
            <Label id="schedule-description-label" htmlFor="schedule-description">
              {tForm('description')}
            </Label>
            <div className="flex flex-wrap items-center gap-1 rounded-t border border-b-0 border-alabaster-700 bg-alabaster-900 p-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={tForm('formatting.bold')}
                title={tForm('formatting.bold')}
                disabled={isPending}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => applyFormatting('bold')}
              >
                <Bold className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={tForm('formatting.italic')}
                title={tForm('formatting.italic')}
                disabled={isPending}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => applyFormatting('italic')}
              >
                <Italic className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={tForm('formatting.bullets')}
                title={tForm('formatting.bullets')}
                disabled={isPending}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => applyFormatting('insertUnorderedList')}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
            <input type="hidden" name="description" value={description} />
            {/* biome-ignore lint/a11y/useSemanticElements: a native textarea cannot render inline rich text. */}
            <div
              ref={descriptionRef}
              id="schedule-description"
              role="textbox"
              aria-labelledby="schedule-description-label"
              tabIndex={0}
              aria-multiline="true"
              aria-disabled={isPending}
              contentEditable={!isPending}
              suppressContentEditableWarning
              data-placeholder={tForm('descriptionPlaceholder')}
              onInput={(event) => {
                const nextDescription = serializeEditor(event.currentTarget)
                if (nextDescription.length > DESCRIPTION_MAX_LENGTH) {
                  renderMarkdownIntoEditor(event.currentTarget, description)
                  return
                }
                setDescription(nextDescription)
              }}
              className="min-h-24 rounded-b border border-alabaster-700 bg-white px-3 py-2 text-sm leading-relaxed text-graphite outline-none empty:before:pointer-events-none empty:before:text-graphite-400 empty:before:content-[attr(data-placeholder)] focus:border-primary focus:ring-2 focus:ring-primary/20 [&_em]:italic [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5"
            />
            <p className="text-xs text-graphite-600">
              {description.length}/{DESCRIPTION_MAX_LENGTH}
            </p>
          </div>
        </div>
      </DialogBody>
      <DialogFormActions t={tForm} isPending={isPending} onCancel={close} />
    </form>
  )
}

function renderMarkdownIntoEditor(editor: HTMLElement, value: string) {
  if (!value) {
    editor.replaceChildren()
    return
  }

  const fragment = document.createDocumentFragment()
  const lines = value.split('\n')
  let list: HTMLUListElement | null = null

  for (const line of lines) {
    if (line.startsWith('- ')) {
      if (!list) {
        list = document.createElement('ul')
        fragment.append(list)
      }
      const item = document.createElement('li')
      appendInlineMarkdown(item, line.slice(2))
      list.append(item)
      continue
    }

    list = null
    const block = document.createElement('div')
    if (line) appendInlineMarkdown(block, line)
    else block.append(document.createElement('br'))
    fragment.append(block)
  }

  editor.replaceChildren(fragment)
}

function appendInlineMarkdown(parent: HTMLElement, value: string) {
  appendInlineNodes(parent, parseSimpleInline(value))
}

function appendInlineNodes(parent: HTMLElement, nodes: SimpleInlineNode[]) {
  for (const node of nodes) {
    if (node.type === 'strong') {
      const strong = document.createElement('strong')
      appendInlineNodes(strong, node.children)
      parent.append(strong)
    } else if (node.type === 'emphasis') {
      const emphasis = document.createElement('em')
      appendInlineNodes(emphasis, node.children)
      parent.append(emphasis)
    } else {
      parent.append(document.createTextNode(node.value))
    }
  }
}

function serializeEditor(editor: HTMLElement | null) {
  if (!editor) return ''
  return Array.from(editor.childNodes).map(serializeEditorNode).join('').trimEnd()
}

function serializeEditorNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? ''
  if (!(node instanceof HTMLElement)) return ''

  const children = Array.from(node.childNodes).map(serializeEditorNode).join('')
  switch (node.tagName) {
    case 'STRONG':
    case 'B':
      return `**${children}**`
    case 'EM':
    case 'I':
      return `_${children}_`
    case 'LI':
      return `- ${children.replace(/\n/g, '')}\n`
    case 'BR':
      return '\n'
    case 'DIV':
    case 'P':
      return `${children}\n`
    default:
      return children
  }
}
