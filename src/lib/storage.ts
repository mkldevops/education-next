import { S3Client } from '@aws-sdk/client-s3'

export type StorageConfig = {
  endpoint: string
  region: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
  forcePathStyle: boolean
}

export function getStorageConfig(): StorageConfig | null {
  const endpoint = process.env.S3_ENDPOINT
  const bucket = process.env.S3_BUCKET
  const accessKeyId = process.env.S3_ACCESS_KEY
  const secretAccessKey = process.env.S3_SECRET_KEY

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return null

  return {
    endpoint,
    bucket,
    accessKeyId,
    secretAccessKey,
    region: process.env.S3_REGION || 'us-east-1',
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
  }
}

const globalForStorage = globalThis as unknown as { s3: S3Client | undefined }

export function getStorageClient(): S3Client | null {
  const config = getStorageConfig()
  if (!config) return null

  if (!globalForStorage.s3) {
    globalForStorage.s3 = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      forcePathStyle: config.forcePathStyle,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    })
  }

  return globalForStorage.s3
}
