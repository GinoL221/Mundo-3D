import { Request, RequestHandler } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { createR2StorageEngine } from '../storage/r2StorageEngine';

interface MulterFile {
  originalname: string;
  mimetype: string;
}

interface MulterInstance {
  single(fieldName: string): RequestHandler;
  array(fieldName: string, maxCount?: number): RequestHandler;
  fields(fields: { name: string; maxCount?: number }[]): RequestHandler;
  none(): RequestHandler;
  any(): RequestHandler;
}

// Development and test keep local-disk storage (no bucket to reach, and the
// existing E2E/dev flows depend on it). It wraps `multer.diskStorage` and adds
// `key` + `location` so controllers and `cleanupUploadedFile` read the same
// fields as the R2 engine — `key` is `<dest>/<uuid><ext>` under public/img and
// `location` is the legacy same-origin `/img/<dest>/<uuid><ext>` that the
// frontend's `resolveImageUrl` already falls back to for non-absolute values.
function createLocalStorageEngine(dest: string): unknown {
  const uploadPath = path.join(process.cwd(), 'public', 'img', dest);
  const disk = multer.diskStorage({
    destination: (_req: Request, _file: unknown, cb: (e: Error | null, d: string) => void) => {
      fs.mkdirSync(uploadPath, { recursive: true });
      cb(null, uploadPath);
    },
    filename: (
      _req: Request,
      file: { originalname: string },
      cb: (e: Error | null, f: string) => void
    ) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
  });

  return {
    _handleFile(
      req: Request,
      file: { key?: string; path?: string },
      cb: (e: unknown, info?: Record<string, unknown>) => void
    ): void {
      disk._handleFile(
        req,
        file,
        (err: unknown, info: { filename: string; path: string } | undefined) => {
          if (err || !info) {
            cb(err ?? new Error('disk storage failed'));
            return;
          }
          const key = `${dest}/${info.filename}`;
          file.key = key;
          file.path = info.path;
          cb(null, { ...info, key, location: `/img/${key}` });
        }
      );
    },
    _removeFile(req: Request, file: unknown, cb: (e: unknown) => void): void {
      disk._removeFile(req, file, cb);
    },
  };
}

export default function createUpload(dest: string): MulterInstance {
  // Production streams straight to the R2 bucket under a `${dest}/<uuid><ext>`
  // key; dev/test write to local disk. Both engines expose `key` + `location`
  // on `req.file`, so nothing downstream branches on the environment.
  const storage =
    process.env.NODE_ENV === 'production'
      ? createR2StorageEngine(dest)
      : createLocalStorageEngine(dest);

  const fileFilter = (
    _req: Request,
    file: MulterFile,
    callback: (error: Error | null, acceptFile?: boolean) => void
  ): void => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      callback(null, true);
      return;
    }
    callback(new Error('Invalid file format or size limit exceeded'), false);
  };

  return multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter,
  }) as unknown as MulterInstance;
}
