import { describe, expect, it } from 'vitest'
import {
  AI_ASSISTANT_LIMITS,
  AI_ASSISTANT_MAX_IMAGE_BASE64_LENGTH,
  AI_ASSISTANT_MODELS,
  DEFAULT_AI_ASSISTANT_MODEL,
  isAiAssistantImageType,
  resolveAiAssistantModel,
} from '../ai-assistant'

describe('resolveAiAssistantModel', () => {
  it('falls back to the default when nothing is configured', () => {
    expect(resolveAiAssistantModel(undefined)).toBe(DEFAULT_AI_ASSISTANT_MODEL)
    expect(resolveAiAssistantModel('')).toBe(DEFAULT_AI_ASSISTANT_MODEL)
  })

  it('accepts every listed model, trimmed', () => {
    for (const model of AI_ASSISTANT_MODELS) {
      expect(resolveAiAssistantModel(` ${model} `)).toBe(model)
    }
  })

  it('refuses a model outside the list rather than forwarding it', () => {
    expect(resolveAiAssistantModel('openai/gpt-3.5-turbo')).toBe(DEFAULT_AI_ASSISTANT_MODEL)
    expect(resolveAiAssistantModel('google/gemini-2.5-flash:free')).toBe(DEFAULT_AI_ASSISTANT_MODEL)
  })

  it('keeps the default inside the list', () => {
    expect(AI_ASSISTANT_MODELS).toContain(DEFAULT_AI_ASSISTANT_MODEL)
  })
})

describe('isAiAssistantImageType', () => {
  it('accepts PNG, JPEG and WebP only', () => {
    expect(isAiAssistantImageType('image/png')).toBe(true)
    expect(isAiAssistantImageType('image/jpeg')).toBe(true)
    expect(isAiAssistantImageType('image/webp')).toBe(true)
    expect(isAiAssistantImageType('image/gif')).toBe(false)
    expect(isAiAssistantImageType('image/svg+xml')).toBe(false)
    expect(isAiAssistantImageType('application/pdf')).toBe(false)
  })
})

describe('AI_ASSISTANT_LIMITS', () => {
  it('derives the base64 ceiling from the byte ceiling', () => {
    expect(AI_ASSISTANT_MAX_IMAGE_BASE64_LENGTH).toBe(
      Math.ceil((AI_ASSISTANT_LIMITS.maxImageBytes / 3) * 4)
    )
  })

  it('never lets one message exceed the whole conversation', () => {
    expect(AI_ASSISTANT_LIMITS.maxImagesPerMessage).toBeLessThanOrEqual(
      AI_ASSISTANT_LIMITS.maxImagesPerRequest
    )
  })
})
