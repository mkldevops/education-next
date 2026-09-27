'use client'

import { Button } from '@peaklab/ui'
import { Printer } from 'lucide-react'

export function PrintButton({ label }: { label: string }) {
  return (
    <Button size="sm" onClick={() => window.print()}>
      <Printer className="h-4 w-4" />
      {label}
    </Button>
  )
}
