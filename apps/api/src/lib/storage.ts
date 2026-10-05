import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export interface Storage {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  /** Remove a stored file. Missing files are not an error. */
  remove(key: string): Promise<void>;
  /** The address the browser should use for this key. */
  urlFor(key: string): string;
}

export const uploadDir = () => process.env.UPLOAD_DIR || join(process.cwd(), 'uploads');

/** True when S3-compatible storage (AWS S3, Cloudflare R2, Backblaze B2...) is configured. */
export const s3Configured = () => Boolean(process.env.S3_ENDPOINT && process.env.S3_BUCKET_NAME && process.env.S3_ACCESS_KEY && process.env.S3_SECRET_KEY);

const local: Storage = {
  async put(key, data) {
    const path = join(uploadDir(), key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, data);
  },
  async remove(key) { await rm(join(uploadDir(), key), { force: true }); },
  urlFor: (key) => `/uploads/${key}`,
};

const s3: Storage = {
  async put(key, data, contentType) {
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
    const client = new S3Client({
      region: process.env.S3_REGION || 'auto',
      endpoint: process.env.S3_ENDPOINT,
      credentials: { accessKeyId: process.env.S3_ACCESS_KEY!, secretAccessKey: process.env.S3_SECRET_KEY! },
    });
    await client.send(new PutObjectCommand({ Bucket: process.env.S3_BUCKET_NAME, Key: key, Body: data, ContentType: contentType, CacheControl: 'public, max-age=31536000, immutable' }));
  },
  async remove(key) {
    const { S3Client, DeleteObjectCommand } = await import('@aws-sdk/client-s3');
    const client = new S3Client({
      region: process.env.S3_REGION || 'auto',
      endpoint: process.env.S3_ENDPOINT,
      credentials: { accessKeyId: process.env.S3_ACCESS_KEY!, secretAccessKey: process.env.S3_SECRET_KEY! },
    });
    await client.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET_NAME, Key: key }));
  },
  urlFor: (key) => `${(process.env.CDN_URL || '').replace(/\/$/, '')}/${key}`,
};

export const getStorage = (): Storage => (s3Configured() ? s3 : local);
