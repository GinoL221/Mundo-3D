import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getR2Client, getBucket } from '../storage/r2Client';
import { logger } from '../logging/logger';

// Best-effort removal of an object the bucket-streaming upload engine already
// wrote before a later pipeline step (validation, or a 404 in the controller)
// rejected the request. Non-blocking: callers must not await this, and a
// failure to remove the object is logged, never thrown, so cleanup issues
// can't turn into a 500 on top of the original rejection.
//
// A falsy key means there legitimately was no upload — return early. A present
// key ALWAYS issues the delete: the previous disk implementation silently
// no-op'd whenever `req.file` had no local `.path`, which is the regression
// this signature change exists to remove.
export function cleanupUploadedFile(key: string | undefined | null): void {
  if (!key) {
    return;
  }

  const bucket = getBucket();

  getR2Client()
    .send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
    .catch((error) => {
      logger.warn(
        { event: 'upload_cleanup_failed', key, bucket, error },
        `Failed to remove orphaned upload: ${key}`
      );
    });
}
