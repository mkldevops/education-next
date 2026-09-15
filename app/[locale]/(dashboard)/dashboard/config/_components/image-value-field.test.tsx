import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: () => Object.assign((key: string) => key, { has: () => true }),
}))
vi.mock('@/i18n/routing', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/lib/toast', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
  toastActionError: vi.fn(),
}))
vi.mock('../../../_lib/media-actions', () => ({ uploadBrandingImageAction: vi.fn() }))

import { MAX_BRANDING_IMAGE_BYTES } from '@/lib/branding-config'
import { toastActionError } from '@/lib/toast'
import { uploadBrandingImageAction } from '../../../_lib/media-actions'
import { ImageValueField } from './image-value-field'

const selectFile = (size: number) => {
  const file = new File(['x'], 'logo.png', { type: 'image/png' })
  Object.defineProperty(file, 'size', { value: size })
  fireEvent.change(document.getElementById('logo-file') as HTMLInputElement, {
    target: { files: [file] },
  })
}

describe('ImageValueField', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('refuses an oversized file without calling the server', () => {
    render(<ImageValueField id="logo" name="value" defaultValue="" />)

    selectFile(MAX_BRANDING_IMAGE_BYTES + 1)

    expect(toastActionError).toHaveBeenCalledWith(expect.anything(), 'fileTooLarge')
    expect(uploadBrandingImageAction).not.toHaveBeenCalled()
  })

  it('uploads a file within the limit and keeps the returned URL', async () => {
    vi.mocked(uploadBrandingImageAction).mockResolvedValue({
      result: 'OK',
      url: '/api/media/x.png',
    })
    render(<ImageValueField id="logo" name="value" defaultValue="" />)

    selectFile(MAX_BRANDING_IMAGE_BYTES)

    await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue('/api/media/x.png'))
    expect(uploadBrandingImageAction).toHaveBeenCalledTimes(1)
  })
})
