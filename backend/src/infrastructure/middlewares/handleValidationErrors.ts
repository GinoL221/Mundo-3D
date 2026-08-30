import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { cleanupUploadedFile } from '../utils/cleanupUploadedFile';

type RequestWithFile = Request & { file?: { key?: string } };

// Shared by any route that runs express-validator field validators after a
// multer upload step. If validation fails and the upload engine already
// streamed an object to the bucket (upload runs before validation in the
// pipeline), delete the now-orphaned object instead of leaving it behind.
export default function handleValidationErrors(
  req: RequestWithFile,
  res: Response,
  next: NextFunction
): void {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    if (req.file?.key) {
      cleanupUploadedFile(req.file.key);
    }
    res.status(400).json({ errors: errors.array() });
    return;
  }
  next();
}
