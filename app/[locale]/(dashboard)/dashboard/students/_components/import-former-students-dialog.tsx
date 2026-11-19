'use client'

import {
  Button,
  cn,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  useDialog,
} from '@peaklab/ui'
import { Camera, FileUp, Loader2, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useRef, useState, useTransition } from 'react'
import {
  countFormerStudentStatuses,
  FORMER_STUDENT_IMPORT_LIMITS,
  type FormerStudentDraft,
  type FormerStudentField,
  type FormerStudentPreviewRow,
  type FormerStudentStatus,
  isImportable,
} from '@/domain/former-student-import'
import { useRouter } from '@/i18n/routing'
import { toast, toastActionError } from '@/lib/toast'
import {
  commitFormerStudentsAction,
  extractFormerStudentsAction,
  previewFormerStudentsAction,
} from '../../../_lib/former-student-import-actions'

const ACCEPT =
  '.png,.jpg,.jpeg,.webp,.pdf,.csv,.txt,.xlsx,image/png,image/jpeg,image/webp,application/pdf,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

const STATUS_CLASS: Record<FormerStudentStatus, string> = {
  create: 'bg-success-subtle text-success',
  existing: 'bg-alabaster-900 text-graphite-600',
  homonym: 'bg-warning-subtle text-warning',
  incomplete: 'bg-danger-subtle text-danger',
}

const STATUSES: FormerStudentStatus[] = ['create', 'homonym', 'existing', 'incomplete']

const EDITABLE: FormerStudentField[] = [
  'lastname',
  'firstname',
  'birthday',
  'className',
  'departureYear',
]

const PLACEHOLDER: Partial<Record<FormerStudentField, 'date' | 'year'>> = {
  birthday: 'date',
  departureYear: 'year',
}

/** Bouton « Importer une liste » des anciens élèves : lecture IA, relecture, puis import. */
export function ImportFormerStudentsDialog() {
  const t = useTranslations('dashboard.pages.students.importFormer')
  return (
    <Dialog>
      <DialogTrigger>
        <Button variant="outline">
          <FileUp className="h-4 w-4" />
          {t('trigger')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-6xl">
        <ImportFormerStudentsContent />
      </DialogContent>
    </Dialog>
  )
}

type Review = {
  rows: FormerStudentDraft[]
  preview: FormerStudentPreviewRow[]
  truncated: boolean
}

function ImportFormerStudentsContent() {
  const t = useTranslations('dashboard.pages.students.importFormer')
  const [review, setReview] = useState<Review | null>(null)

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('title')}</DialogTitle>
      </DialogHeader>
      {review ? (
        <ReviewStep initial={review} onRestart={() => setReview(null)} />
      ) : (
        <UploadStep onRead={setReview} />
      )}
    </>
  )
}

/** Identité d'un fichier choisi : sert de clé et évite d'ajouter deux fois le même. */
const fileKey = (file: File) => `${file.name}:${file.size}:${file.lastModified}`

function UploadStep({ onRead }: { onRead: (review: Review) => void }) {
  const t = useTranslations('dashboard.pages.students.importFormer')
  const { setOpen } = useDialog()
  const [files, setFiles] = useState<File[]>([])
  const [isPending, startTransition] = useTransition()
  const { maxFiles, maxFileBytes, maxTotalBytes } = FORMER_STUDENT_IMPORT_LIMITS

  const addFiles = (list: FileList | null) => {
    if (!list) return
    const known = new Set(files.map(fileKey))
    const next = [...files, ...Array.from(list).filter((file) => !known.has(fileKey(file)))]
    if (next.length > maxFiles) {
      toast.error(t('errors.tooManyFiles'))
      return
    }
    const total = next.reduce((sum, file) => sum + file.size, 0)
    if (next.some((file) => file.size > maxFileBytes) || total > maxTotalBytes) {
      toast.error(t('errors.fileTooLarge'))
      return
    }
    setFiles(next)
  }

  const read = () =>
    startTransition(async () => {
      const formData = new FormData()
      for (const file of files) formData.append('files', file)
      const result = await extractFormerStudentsAction(formData)
      if (result.status !== 'OK') {
        toastActionError(t, result.status)
        return
      }
      onRead({ rows: result.rows, preview: result.preview, truncated: result.truncated })
    })

  return (
    <>
      <DialogBody className="space-y-4">
        <p className="text-graphite-600 text-sm">{t('uploadHelp')}</p>
        <div className="flex flex-wrap gap-2">
          <FilePickerButton
            label={t('chooseFiles')}
            icon={<FileUp className="h-4 w-4" />}
            accept={ACCEPT}
            multiple
            disabled={isPending || files.length >= maxFiles}
            onFiles={addFiles}
          />
          <FilePickerButton
            label={t('takePhoto')}
            icon={<Camera className="h-4 w-4" />}
            accept="image/*"
            capture="environment"
            disabled={isPending || files.length >= maxFiles}
            onFiles={addFiles}
          />
        </div>
        {files.length > 0 && (
          <ul className="space-y-1" aria-label={t('selectedFiles')}>
            {files.map((file, index) => (
              <li
                key={fileKey(file)}
                className="flex items-center justify-between rounded-md border px-3 py-1.5 text-sm"
              >
                <span className="truncate text-graphite">{file.name}</span>
                <button
                  type="button"
                  className="text-graphite-600 hover:text-graphite"
                  aria-label={t('removeFile', { name: file.name })}
                  disabled={isPending}
                  onClick={() => setFiles(files.filter((_, i) => i !== index))}
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {isPending && (
          <p className="flex items-center gap-2 text-graphite text-sm" role="status">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('reading')}
          </p>
        )}
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
          {t('cancel')}
        </Button>
        <Button onClick={read} disabled={isPending || files.length === 0}>
          {t('read')}
        </Button>
      </DialogFooter>
    </>
  )
}

function FilePickerButton({
  label,
  icon,
  onFiles,
  disabled,
  ...inputProps
}: {
  label: string
  icon: React.ReactNode
  onFiles: (files: FileList | null) => void
  disabled: boolean
  accept: string
  multiple?: boolean
  capture?: 'environment'
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        tabIndex={-1}
        aria-label={label}
        disabled={disabled}
        onChange={(event) => {
          onFiles(event.target.files)
          event.target.value = ''
        }}
        {...inputProps}
      />
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        {icon}
        {label}
      </Button>
    </>
  )
}

function ReviewStep({ initial, onRestart }: { initial: Review; onRestart: () => void }) {
  const t = useTranslations('dashboard.pages.students.importFormer')
  const { setOpen } = useDialog()
  const router = useRouter()
  const [rows, setRows] = useState(initial.rows)
  const [preview, setPreview] = useState(initial.preview)
  const [isChecking, setIsChecking] = useState(false)
  const [isCommitting, startCommit] = useTransition()
  const latestRequest = useRef(0)
  const dirty = useRef(false)

  const previewById = new Map(preview.map((entry) => [entry.id, entry]))
  const counts = countFormerStudentStatuses(rows, preview)
  const importCount = rows.filter((row) => {
    const entry = previewById.get(row.id)
    return entry ? isImportable(row, entry) : false
  }).length

  const refreshPreview = async (next: FormerStudentDraft[]) => {
    const request = ++latestRequest.current
    setIsChecking(true)
    const result = await previewFormerStudentsAction(next)
    if (request !== latestRequest.current) return
    setIsChecking(false)
    if (result.status !== 'OK') {
      toastActionError(t, result.status)
      return
    }
    setPreview(result.preview)
  }

  const editCell = (id: string, field: FormerStudentField, value: string) => {
    dirty.current = true
    setRows((current) =>
      current.map((row) =>
        row.id === id
          ? { ...row, [field]: value, uncertain: row.uncertain.filter((item) => item !== field) }
          : row
      )
    )
  }

  const commitEdit = () => {
    if (!dirty.current) return
    dirty.current = false
    void refreshPreview(rows)
  }

  const toggleRow = (id: string, included: boolean) => {
    const next = rows.map((row) => (row.id === id ? { ...row, included } : row))
    setRows(next)
    void refreshPreview(next)
  }

  const importRows = () =>
    startCommit(async () => {
      const result = await commitFormerStudentsAction(rows)
      if (result.status !== 'OK') {
        toastActionError(t, result.status)
        return
      }
      toast.success(t('success', { created: result.created, skipped: result.skipped }))
      setOpen(false)
      router.refresh()
    })

  return (
    <>
      <DialogBody className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {STATUSES.map((status) => (
            <span
              key={status}
              data-testid={`chip-${status}`}
              className={cn('rounded-full px-2.5 py-0.5 font-medium text-xs', STATUS_CLASS[status])}
            >
              {t(`chips.${status}`, { count: counts[status] })}
            </span>
          ))}
          {isChecking && <Loader2 className="h-4 w-4 animate-spin text-graphite-600" />}
        </div>
        {initial.truncated && <p className="text-sm text-warning">{t('truncated')}</p>}
        <p className="text-graphite-600 text-xs">{t('reviewHelp')}</p>
        <div className="max-h-[55vh] overflow-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-background text-left text-graphite-600 text-xs">
              <tr>
                <th className="w-8 px-2 py-2">
                  <span className="sr-only">{t('columns.include')}</span>
                </th>
                {EDITABLE.map((field) => (
                  <th key={field} className="px-2 py-2 font-medium">
                    {t(`columns.${field}`)}
                  </th>
                ))}
                <th className="px-2 py-2 font-medium">{t('columns.status')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const entry = previewById.get(row.id)
                const name = `${row.firstname} ${row.lastname}`.trim() || String(index + 1)
                return (
                  <tr key={row.id} className={cn('border-t', !row.included && 'opacity-50')}>
                    <td className="px-2 py-1">
                      <input
                        type="checkbox"
                        checked={row.included}
                        aria-label={t('includeRow', { name })}
                        onChange={(event) => toggleRow(row.id, event.target.checked)}
                      />
                    </td>
                    {EDITABLE.map((field) => {
                      const uncertain = row.uncertain.includes(field)
                      const placeholder = PLACEHOLDER[field]
                      return (
                        <td key={field} className="px-1 py-1">
                          <input
                            value={row[field]}
                            placeholder={placeholder && t(`placeholders.${placeholder}`)}
                            aria-label={`${t(`columns.${field}`)} ${index + 1}`}
                            title={uncertain ? t('uncertain') : undefined}
                            data-uncertain={uncertain || undefined}
                            className={cn(
                              'h-8 w-full min-w-20 rounded border border-transparent bg-transparent px-2 hover:border-alabaster-900 focus:border-graphite-600 focus:outline-none',
                              uncertain && 'bg-warning-subtle'
                            )}
                            onChange={(event) => editCell(row.id, field, event.target.value)}
                            onBlur={commitEdit}
                          />
                        </td>
                      )
                    })}
                    <td className="px-2 py-1">
                      {entry && (
                        <span
                          className={cn(
                            'whitespace-nowrap rounded-full px-2 py-0.5 text-xs',
                            STATUS_CLASS[entry.status]
                          )}
                          title={entry.issues.map((issue) => t(`issues.${issue}`)).join(' · ')}
                        >
                          {t(`statuses.${entry.status}`)}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" onClick={onRestart} disabled={isCommitting}>
          {t('restart')}
        </Button>
        <Button onClick={importRows} disabled={isCommitting || isChecking || importCount === 0}>
          {t('import', { count: importCount })}
        </Button>
      </DialogFooter>
    </>
  )
}
