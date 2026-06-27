import { Request, RequestHandler } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

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
  const storage = multer.diskStorage({
    destination: (
      _req: Request,
      _file: MulterFile,
      callback: (error: Error | null, destination: string) => void
    ) => {
      const uploadPath = path.join(process.cwd(), 'public', 'img', dest);
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }
      callback(null, uploadPath);
    },
    filename: (
      _req: Request,
      file: MulterFile,
      callback: (error: Error | null, filename: string) => void
    ) => {
      callback(null, `${uuidv4()}${path.extname(file.originalname)}`);
    },
  });

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
