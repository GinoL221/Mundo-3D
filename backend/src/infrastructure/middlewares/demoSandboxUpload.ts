import path from 'node:path';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import multer from 'multer';
import { createProductCreateValidators } from './validators/productValidators';

const ACCEPTED_EXTS = new Set(['.jpg', '.png']);
const ACCEPTED_MIMES = new Set(['image/jpeg', 'image/png']);
const MAX_DEMO_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_DEMO_UPLOAD_FILES = 1;
const MAX_DEMO_UPLOAD_FIELDS = 20;
const MAX_DEMO_UPLOAD_PARTS = 25;

interface MulterFile {
  originalname: string;
  mimetype: string;
}

interface MulterLikeError extends Error {
  code?: string;
}

function getMulterErrorCode(err: unknown): string | undefined {
  if (err instanceof Error && 'code' in err && typeof (err as MulterLikeError).code === 'string') {
    return (err as MulterLikeError).code;
  }
  return undefined;
}

function mapUploadError(err: unknown): { status: number; message: string } {
  switch (getMulterErrorCode(err)) {
    case 'LIMIT_FILE_SIZE':
      return { status: 413, message: 'La imagen supera el tamaño máximo permitido de 5 MB' };
    case 'LIMIT_FILE_COUNT':
      return { status: 413, message: 'Solo se permite subir una imagen por solicitud' };
    case 'LIMIT_FIELD_COUNT':
      return { status: 413, message: 'La solicitud supera el límite permitido de campos' };
    case 'LIMIT_PART_COUNT':
      return { status: 413, message: 'La solicitud supera el límite permitido de partes' };
    case 'LIMIT_FIELD_KEY':
    case 'LIMIT_FIELD_VALUE':
      return { status: 413, message: 'La solicitud supera el tamaño máximo permitido' };
    case 'LIMIT_UNEXPECTED_FILE':
      return { status: 400, message: 'Solo se permite un archivo en el campo image' };
    default:
      return {
        status: 400,
        message: err instanceof Error ? err.message : 'Archivo de imagen inválido',
      };
  }
}

const demoMemoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_DEMO_UPLOAD_BYTES,
    files: MAX_DEMO_UPLOAD_FILES,
    fields: MAX_DEMO_UPLOAD_FIELDS,
    parts: MAX_DEMO_UPLOAD_PARTS,
  },
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
    const { status, message } = mapUploadError(err);
    res.status(status).json({ error: message, errors: [{ path: 'image', msg: message }] });
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

// Compose production create validators with optional image so demo product
// creation validates all fields while keeping image upload optional.
export const demoProductCreateValidators = createProductCreateValidators({ requireImage: false });
