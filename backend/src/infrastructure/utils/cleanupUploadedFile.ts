import fs from 'fs';
import { logger } from '../logging/logger';

// Best-effort removal of a file multer already wrote to disk before a later
// pipeline step (validation, or a 404 in the controller) rejected the
// request. Non-blocking: callers must not await this, and a failure to
// remove the file is logged, never thrown, so cleanup issues can't turn
// into a 500 on top of the original rejection.
export function cleanupUploadedFile(filePath: string | undefined | null): void {
  if (!filePath) {
    return;
  }

  fs.unlink(filePath, (error) => {
    if (error) {
      logger.warn(
        {
          event: 'upload_cleanup_failed',
          filePath,
          error: error.message,
        },
        `Failed to remove orphaned upload: ${filePath}`
      );
    }
  });
}
