import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getCwd } from '@/lib/db';
import fs from 'fs';
import path from 'path';

/**
 * Абстракция хранилища медиа.
 * Local — файловая система (data/uploads).
 * S3 — S3-совместимый object storage (R2/MinIO/S3), настраивается через MEDIA_S3_*.
 */
export type StoredFile = { url: string };

interface MediaStorage {
  save(name: string, data: Buffer, contentType: string): Promise<StoredFile>;
}

class LocalMediaStorage implements MediaStorage {
  async save(name: string, data: Buffer): Promise<StoredFile> {
    const dir = path.join(getCwd(), 'data', 'uploads');
    const filePath = path.join(dir, name);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, data);
    return { url: `/api/media/${name}` };
  }
}

class S3MediaStorage implements MediaStorage {
  private client: S3Client;
  private bucket: string;
  private publicUrl: string;

  constructor() {
    const endpoint = process.env.MEDIA_S3_ENDPOINT || '';
    const region = process.env.MEDIA_S3_REGION || 'auto';
    const accessKey = process.env.MEDIA_S3_ACCESS_KEY || '';
    const secretKey = process.env.MEDIA_S3_SECRET_KEY || '';
    this.bucket = process.env.MEDIA_S3_BUCKET || 'rip-media';
    this.publicUrl = process.env.MEDIA_S3_PUBLIC_URL || '';

    if (!endpoint || !accessKey || !secretKey) {
      throw new Error('S3 storage: MEDIA_S3_ENDPOINT/ACCESS_KEY/SECRET_KEY обязательны');
    }
    this.client = new S3Client({
      endpoint,
      region,
      credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
      forcePathStyle: true, // для R2/MinIO
    });
  }

  async save(name: string, data: Buffer, contentType: string): Promise<StoredFile> {
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: name,
      Body: data,
      ContentType: contentType,
    }));
    const base = this.publicUrl || process.env.MEDIA_S3_ENDPOINT || '';
    return { url: `${base.replace(/\/$/, '')}/${this.bucket}/${name}` };
  }
}

let storage: MediaStorage | null = null;
export function getMediaStorage(): MediaStorage {
  if (storage) return storage;
  storage = process.env.MEDIA_S3_ENDPOINT ? new S3MediaStorage() : new LocalMediaStorage();
  return storage;
}