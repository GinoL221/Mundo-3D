import path from 'path';
import type { Request } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getR2Client, getBucket, publicUrlFor } from './r2Client';

// Minimal shape of the multer file object this engine touches. multer fills
// `originalname`/`mimetype` from the request and `stream` from busboy before
// calling `_handleFile`; `key` is written back by this engine and read later
// by `_removeFile` and the cleanup util.
interface EngineFile {
  originalname: string;
  mimetype: string;
  stream: NodeJS.ReadableStream;
  key?: string;
}

interface HandledFileInfo {
  key: string;
  bucket: string;
  location: string;
  size: number;
}

type HandleFileCallback = (error: unknown, info?: Partial<HandledFileInfo>) => void;
type RemoveFileCallback = (error: unknown) => void;

// Hand-written multer StorageEngine over @aws-sdk/client-s3 pointed at R2.
// `multer-s3` is not used: its `.location` derives from the (non-public) S3 API
// endpoint, it sends an `ACL` R2 rejects, and `@types/multer-s3` would pull the
// `@types/multer` this repo deliberately avoids.
export class R2StorageEngine {
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

    // multer enforces `limits.fileSize` upstream; busboy emits 'limit' on the
    // stream when the ceiling is hit. Do NOT upload a truncated object — let
    // multer surface its own LIMIT_FILE_SIZE error to the client.
    file.stream.once('limit', () => {
      fail(new Error('File size limit exceeded'));
    });

    file.stream.once('error', (error: Error) => {
      fail(error);
    });

    file.stream.once('end', () => {
      if (settled) return;

      const body = Buffer.concat(chunks);
      const key = `${this.dest}/${uuidv4()}${path.extname(file.originalname)}`;
      const bucket = getBucket();

      getR2Client()
        .send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: body,
            // Always the validated mimetype, never inferred from the key
            // suffix — the public host must serve `image/*` even for an
            // adversarial `evil.png.exe` original name.
            ContentType: file.mimetype,
            ContentLength: body.length,
          })
        )
        .then(() => {
          if (settled) return;
          settled = true;
          file.key = key;
          cb(null, { key, bucket, location: publicUrlFor(key), size: body.length });
        })
        .catch(fail);
    });
  }

  _removeFile(_req: Request, file: EngineFile, cb: RemoveFileCallback): void {
    getR2Client()
      .send(new DeleteObjectCommand({ Bucket: getBucket(), Key: file.key as string }))
      .then(() => cb(null))
      .catch((error) => cb(error));
  }
}

export function createR2StorageEngine(dest: string): R2StorageEngine {
  return new R2StorageEngine(dest);
}
