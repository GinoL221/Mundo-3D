import { randomUUID } from 'node:crypto';
import type { Request } from 'express';
import {
  getCloudinaryConfig,
  signCloudinaryParams,
  destroyCloudinaryImage,
} from './cloudinaryClient';
import { resolveSafeImageMime } from './r2StorageEngine';

interface EngineFile {
  originalname: string;
  mimetype: string;
  stream: NodeJS.ReadableStream;
  key?: string;
}

interface HandledFileInfo {
  key: string;
  location: string;
  size: number;
}

type HandleFileCallback = (error: unknown, info?: Partial<HandledFileInfo>) => void;
type RemoveFileCallback = (error: unknown) => void;

interface CloudinaryUploadPayload {
  public_id?: unknown;
  secure_url?: unknown;
  bytes?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export class CloudinaryStorageEngine {
  constructor(private readonly dest: string) {}

  _handleFile(_req: Request, file: EngineFile, cb: HandleFileCallback): void {
    const chunks: Buffer[] = [];
    let settled = false;

    const fail = (error: unknown): void => {
      if (settled) return;
      settled = true;
      cb(error);
    };

    file.stream.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    file.stream.once('limit', () => {
      fail(new Error('File size limit exceeded'));
    });

    file.stream.once('error', (error: Error) => {
      fail(error);
    });

    file.stream.once('end', () => {
      if (settled) return;

      void this.uploadBuffer(Buffer.concat(chunks), file)
        .then((info) => {
          if (settled) return;
          settled = true;
          file.key = info.key;
          cb(null, info);
        })
        .catch(fail);
    });
  }

  private async uploadBuffer(body: Buffer, file: EngineFile): Promise<HandledFileInfo> {
    const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();
    const publicId = `${this.dest}/${randomUUID()}`;
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = signCloudinaryParams({ public_id: publicId, timestamp }, apiSecret);
    const safeMime = resolveSafeImageMime(file.originalname, file.mimetype);

    const formData = new FormData();
    formData.append(
      'file',
      new Blob([new Uint8Array(body)], { type: safeMime }),
      file.originalname,
    );
    formData.append('api_key', apiKey);
    formData.append('timestamp', String(timestamp));
    formData.append('public_id', publicId);
    formData.append('signature', signature);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const bodyText = await response.text();
      throw new Error(`Cloudinary upload failed (${response.status}): ${bodyText}`);
    }

    const raw: unknown = await response.json();
    const payload: CloudinaryUploadPayload = isRecord(raw) ? raw : {};

    if (typeof payload.secure_url !== 'string' || payload.secure_url.length === 0) {
      throw new Error('Cloudinary upload response missing secure_url');
    }

    const resolvedKey =
      typeof payload.public_id === 'string' && payload.public_id.length > 0
        ? payload.public_id
        : publicId;
    const resolvedSize = typeof payload.bytes === 'number' ? payload.bytes : body.length;

    return {
      key: resolvedKey,
      location: payload.secure_url,
      size: resolvedSize,
    };
  }

  _removeFile(_req: Request, file: EngineFile, cb: RemoveFileCallback): void {
    destroyCloudinaryImage(file.key as string)
      .then(() => cb(null))
      .catch((error) => cb(error));
  }
}

export function createCloudinaryStorageEngine(dest: string): CloudinaryStorageEngine {
  return new CloudinaryStorageEngine(dest);
}
