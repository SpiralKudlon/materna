import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import pino from 'pino'

const logger = pino()

// Initialize S3 client. In development we might point to LocalStack or MinIO
const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  endpoint: process.env.S3_ENDPOINT, // Optional for testing against minio
  forcePathStyle: !!process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'mock',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'mock',
  }
})

const BUCKET_NAME = process.env.REPORTS_BUCKET || "maternal-reports-test"

export async function uploadAndPresign(
  fileBuffer: Buffer | string,
  fileName: string,
  contentType: string
): Promise<string> {
  try {
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fileName,
      Body: fileBuffer,
      ContentType: contentType,
    })

    // Upload to S3
    await s3Client.send(command)

    // Generate pre-signed URL valid for 30 minutes
    const url = await getSignedUrl(s3Client, command, { expiresIn: 1800 })
    return url

  } catch (error) {
    logger.error({ err: error }, `Failed to upload ${fileName} to S3`)
    throw new Error("Failed to generate report storage URL")
  }
}
