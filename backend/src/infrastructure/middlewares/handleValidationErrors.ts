import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { cleanupUploadedFile } from '../utils/cleanupUploadedFile';

type RequestWithFile = Request & { file?: { path?: string } };

// Shared by any route that runs express-validator field validators after a
// multer upload step. If validation fails and multer already wrote a file
// to disk (upload runs before validation in the pipeline), remove the
// now-orphaned file instead of leaving it behind.
export default function handleValidationErrors(
  req: RequestWithFile,
  res: Response,
  next: NextFunction
): void {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    if (req.file?.path) {
      cleanupUploadedFile(req.file.path);
    }
    res.status(400).json({ errors: errors.array() });
    return;
  }
  next();
}
