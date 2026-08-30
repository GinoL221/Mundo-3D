import { Request, RequestHandler } from 'express';
import multer from 'multer';
import path from 'path';
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

export default function createUpload(dest: string): MulterInstance {
  // Destination is an S3-compatible remote bucket, not local disk. The engine
  // streams the file straight to R2 under a `${dest}/<uuid><ext>` key.
  const storage = createR2StorageEngine(dest);

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
