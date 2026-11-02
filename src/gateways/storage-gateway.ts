import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3'
import { getStorageClient, getStorageConfig } from '@/lib/storage'

export type StoredObject = {
  body: ReadableStream
  contentType: string
  contentLength?: number
  contentRange?: string
}

async function ensureBucket(): Promise<'OK' | 'notConfigured'> {
  const client = getStorageClient()
  const config = getStorageConfig()
  if (!client || !config) return 'notConfigured'

  try {
    await client.send(new HeadBucketCommand({ Bucket: config.bucket }))
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: config.bucket }))
  }

  return 'OK'
}

export const storageGateway = {
  put: async (input: {
    key: string
    body: Uint8Array
    contentType: string
  }): Promise<'OK' | 'notConfigured'> => {
    const bucketReady = await ensureBucket()
    if (bucketReady !== 'OK') return bucketReady

    const client = getStorageClient()
    const config = getStorageConfig()
    if (!client || !config) return 'notConfigured'

    await client.send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
      })
    )

    return 'OK'
  },

  get: async (
    key: string,
    range?: string
  ): Promise<StoredObject | 'notFound' | 'notConfigured' | 'invalidRange'> => {
    const client = getStorageClient()
    const config = getStorageConfig()
    if (!client || !config) return 'notConfigured'

    try {
      const result = await client.send(
        new GetObjectCommand({ Bucket: config.bucket, Key: key, Range: range })
      )
      if (!result.Body) return 'notFound'

      return {
        body: result.Body.transformToWebStream(),
        contentType: result.ContentType || 'application/octet-stream',
        contentLength: result.ContentLength,
        contentRange: result.ContentRange,
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'InvalidRange') return 'invalidRange'
      return 'notFound'
    }
  },
}
