import fs from 'fs';
import path from 'path';
import { getCwd } from '@/lib/db';

/**
 * Абстракция хранилища медиа.
 * Локально — файловая система (data/uploads).
 * Продакшн — S3-совместимый object storage (R2/MinIO/S3), если задан MEDIA_S3_*.
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
  private bucket: string;
  private endpoint: string;
  private region: string;
  private accessKey: string;
  private secretKey: string;
  private publicUrl: string;

  constructor() {
    this.bucket = process.env.MEDIA_S3_BUCKET || 'rip-media';
    this.endpoint = process.env.MEDIA_S3_ENDPOINT || '';
    this.region = process.env.MEDIA_S3_REGION || 'auto';
    this.accessKey = process.env.MEDIA_S3_ACCESS_KEY || '';
    this.secretKey = process.env.MEDIA_S3_SECRET_KEY || '';
    this.publicUrl = process.env.MEDIA_S3_PUBLIC_URL || '';
    if (!this.endpoint || !this.accessKey || !this.secretKey) {
      throw new Error('S3 storage настроен не полностью: MEDIA_S3_ENDPOINT/ACCESS_KEY/SECRET_KEY');
    }
  }

  async save(name: string, data: Buffer, contentType: string): Promise<StoredFile> {
    // минимальный S3 PUT (R2/MinIO совместимы)
    const url = `${this.endpoint.replace(/\/$/, '')}/${this.bucket}/${name}`;
    const date = new Date().toUTCString();
    const resource = `/${this.bucket}/${name}`;

    // сигнатура AWS SigV4 (упрощённо для публичных bucket; для приватных нужен full signer)
    const payloadHash = sha256Hex(data);
    const canonicalHeaders = `content-type:${contentType}\nhost:${hostOf(this.endpoint)}\nx-amz-date:${date}\n`;
    const signedHeaders = 'content-type;host;x-amz-date';
    const canonicalRequest = [
      'PUT',
      resource,
      '',
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');

    const scope = `${date.slice(0, 8)}/${this.region}/s3/aws4_request`;
    const stringToSign = ['AWS4-HMAC-SHA256', date, scope, sha256Hex(canonicalRequest)].join('\n');
    const signingKey = hmacChain([
      'AWS4' + this.secretKey,
      date.slice(0, 8),
      this.region,
      's3',
      'aws4_request',
    ]);
    const signature = hmacHex(signingKey, stringToSign);

    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
        'x-amz-date': date,
        'x-amz-content-sha256': payloadHash,
        Authorization: `AWS4-HMAC-SHA256 Credential=${this.accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
      },
      body: new Uint8Array(data),
    });
    if (!res.ok) throw new Error(`S3 upload failed: ${res.status}`);
    const base = this.publicUrl || this.endpoint.replace(/\/$/, '');
    return { url: `${base}/${this.bucket}/${name}` };
  }
}

function sha256Hex(data: Buffer | string): string {
  const crypto = require('crypto') as typeof import('crypto');
  return crypto.createHash('sha256').update(data).digest('hex');
}
function hmacHex(key: Buffer | string, data: string): string {
  const crypto = require('crypto') as typeof import('crypto');
  return crypto.createHmac('sha256', key).update(data).digest('hex');
}
function hmacChain(parts: (string | Buffer)[]): Buffer {
  const crypto = require('crypto') as typeof import('crypto');
  const [first, ...rest] = parts;
  return rest.reduce((acc: Buffer, p: string | Buffer) => crypto.createHmac('sha256', acc).update(p).digest(), Buffer.from(first));
}
function hostOf(endpoint: string): string {
  try { return new URL(endpoint).host; } catch { return endpoint; }
}

let storage: MediaStorage | null = null;
export function getMediaStorage(): MediaStorage {
  if (storage) return storage;
  if (process.env.MEDIA_S3_ENDPOINT) {
    storage = new S3MediaStorage();
  } else {
    storage = new LocalMediaStorage();
  }
  return storage;
}
