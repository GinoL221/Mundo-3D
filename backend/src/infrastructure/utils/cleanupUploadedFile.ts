import path from 'path';
import fs from 'fs';
import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getR2Client, getBucket } from '../storage/r2Client';
import { logger } from '../logging/logger';

// Best-effort removal of an image the upload engine already wrote before a
// later pipeline step (validation, or a 404 in the controller) rejected the
// request. Non-blocking: callers must not await this, and a failure to remove
// is logged, never thrown, so cleanup issues can't turn into a 500 on top of
// the original rejection.
//
// `key` is always `<dest>/<uuid><ext>` (both storage engines set it). A falsy
// key means there legitimately was no upload — return early. A present key
// ALWAYS issues a delete: in production against the R2 bucket, in dev/test
// against local disk under public/img.
export function cleanupUploadedFile(key: string | undefined | null): void {
  if (!key) {
    return;
  }

  if (process.env.NODE_ENV === 'production') {
    const bucket = getBucket();
    getR2Client()
      .send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
      .catch((error) => {
        logger.warn(
          { event: 'upload_cleanup_failed', key, bucket, error },
          `Failed to remove orphaned upload: ${key}`
        );
      });
    return;
  }

  const filePath = path.join(process.cwd(), 'public', 'img', key);
  fs.promises.unlink(filePath).catch((error) => {
    logger.warn(
      { event: 'upload_cleanup_failed', key, filePath, error },
      `Failed to remove orphaned upload: ${key}`
    );
  });
}
