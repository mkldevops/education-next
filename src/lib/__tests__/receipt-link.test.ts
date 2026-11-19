import { describe, expect, it } from 'vitest'
import {
  currentDashboardPath,
  receiptHref,
  receiptReturnKind,
  safeReceiptReturnPath,
} from '../receipt-link'

describe('safeReceiptReturnPath', () => {
  it('keeps a dashboard path with its query', () => {
    expect(safeReceiptReturnPath('/dashboard/payments?status=late')).toBe(
      '/dashboard/payments?status=late'
    )
    expect(safeReceiptReturnPath('/dashboard')).toBe('/dashboard')
  })

  it.each([
    null,
    undefined,
    '',
    'https://evil.test/dashboard',
    '//evil.test/dashboard',
    '/\\evil.test',
    '/dashboardx',
    '/fr/dashboard/families/1',
    `/dashboard/${'a'.repeat(600)}`,
  ])('rejects %s', (from) => {
    expect(safeReceiptReturnPath(from)).toBeNull()
  })
})

describe('receiptReturnKind', () => {
  it('recognizes the family page, the cashier and anything else', () => {
    expect(receiptReturnKind('/dashboard/families/f-1')).toBe('family')
    expect(receiptReturnKind('/dashboard/cashier')).toBe('cashier')
    expect(receiptReturnKind('/dashboard/cashier/day?day=2026-11-19')).toBe('cashier')
    expect(receiptReturnKind('/dashboard/payments?page=2')).toBe('other')
    expect(receiptReturnKind('/dashboard/families')).toBe('other')
  })
})

describe('receiptHref', () => {
  it('carries the origin and the action', () => {
    expect(receiptHref('r-1')).toBe('/dashboard/cashier/receipts/r-1')
    expect(receiptHref('r-1', '/dashboard/payments?page=2')).toBe(
      '/dashboard/cashier/receipts/r-1?from=%2Fdashboard%2Fpayments%3Fpage%3D2'
    )
    expect(receiptHref('r-1', '//evil.test', { action: 'cancel' })).toBe(
      '/dashboard/cashier/receipts/r-1?action=cancel'
    )
  })
})

describe('currentDashboardPath', () => {
  it('drops the locale prefix and the dialog action, keeps the query', () => {
    window.history.replaceState(null, '', '/en/dashboard/payments?page=2')
    expect(currentDashboardPath()).toBe('/dashboard/payments?page=2')
    window.history.replaceState(null, '', '/fr/dashboard/families/f-1?action=addPayment&tab=2')
    expect(currentDashboardPath()).toBe('/dashboard/families/f-1?tab=2')
    window.history.replaceState(null, '', '/fr/login')
    expect(currentDashboardPath()).toBeNull()
  })
})
