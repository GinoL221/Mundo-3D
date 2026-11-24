import path from 'node:path';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { body } from 'express-validator';
import multer from 'multer';
import { productCreateValidators } from './validators/productValidators';

const ACCEPTED_EXTS = new Set(['.jpg', '.png']);
const ACCEPTED_MIMES = new Set(['image/jpeg', 'image/png']);

interface MulterFile {
  originalname: string;
  mimetype: string;
}

const demoMemoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (
    _req: Request,
    file: MulterFile,
    cb: (error: Error | null, acceptFile?: boolean) => void,
  ) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ACCEPTED_EXTS.has(ext) && ACCEPTED_MIMES.has(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new Error('Las extensiones de archivos permitidas son .jpg, .png'));
  },
});

export const demoProductUpload: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  if (!req.is('multipart/form-data')) return next();
  demoMemoryUpload.single('image')(req, res, (err: unknown) => {
    if (!err) return next();
    const message = err instanceof Error ? err.message : 'Archivo de imagen inválido';
    res.status(400).json({ error: message, errors: [{ path: 'image', msg: message }] });
  });
};

// Discard any in-memory uploaded bytes before reaching ProductApiController so
// Demo Sandbox never writes to R2, Cloudinary, or local disk: create stores
// `image: null` (neutral workshop placeholder) and update preserves the current
// seeded image.
export const stripDemoUploadedFile: RequestHandler = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  delete (req as Request & { file?: unknown }).file;
  next();
};

// Reuse all production create validators except the required-image check (index
// 5 in `productCreateValidators`), because demo product creation makes image
// upload optional and never persists external uploads.
export const demoProductCreateValidators = [
  ...productCreateValidators.slice(0, 5),
  body('image').optional(),
  ...productCreateValidators.slice(6),
];
