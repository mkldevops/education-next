'use client'

import { useMenu } from '@peaklab/ui'
import { ChevronDown, Download, FileSpreadsheet, Printer } from 'lucide-react'

export function AttendanceExportMenu({
  csv,
  filename,
  labels,
}: {
  csv: string
  filename: string
  labels: { trigger: string; print: string; printHint: string; csv: string; csvHint: string }
}) {
  const { open, close, toggle, containerRef, triggerRef, menuRef } = useMenu()

  const print = () => {
    close(false)
    requestAnimationFrame(() => window.print())
  }

  const download = () => {
    close(false)
    const url = URL.createObjectURL(new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  }

  const itemClass =
    'flex w-full items-start gap-2 rounded px-2 py-2 text-left text-sm hover:bg-alabaster-800 focus:bg-alabaster-800 focus:outline-none'

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        ref={triggerRef}
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex min-h-11 items-center gap-2 rounded border border-alabaster-600 bg-white px-3 text-sm font-semibold text-graphite hover:bg-alabaster-800"
      >
        <Download aria-hidden="true" className="size-4" />
        {labels.trigger}
        <ChevronDown aria-hidden="true" className="size-4" />
      </button>
      <div
        ref={menuRef}
        role="menu"
        className={`absolute top-full right-0 z-40 mt-1 w-64 rounded border border-alabaster-700 bg-white p-1 shadow-lg ${open ? '' : 'hidden'}`}
      >
        <button type="button" role="menuitem" onClick={print} className={itemClass}>
          <Printer aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>
            <span className="block font-medium text-graphite">{labels.print}</span>
            <span className="block text-xs text-graphite-600">{labels.printHint}</span>
          </span>
        </button>
        <button type="button" role="menuitem" onClick={download} className={itemClass}>
          <FileSpreadsheet aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>
            <span className="block font-medium text-graphite">{labels.csv}</span>
            <span className="block text-xs text-graphite-600">{labels.csvHint}</span>
          </span>
        </button>
      </div>
    </div>
  )
}
