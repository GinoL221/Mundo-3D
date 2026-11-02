import 'express';

declare global {
  namespace Express {
    interface Request {
      reqId?: string;
      sandbox?: { slotId: string; leaseId: string; idleExpiresAt: Date };
      user?: {
        userId: number;
        email?: string;
        category?: string;
        idRole?: number;
      };
      file?: {
        fieldname?: string;
        originalname?: string;
        encoding?: string;
        mimetype?: string;
        size?: number;
        // R2 storage-engine fields (see infrastructure/storage/r2StorageEngine.ts).
        // Present on every `req.file` the engine produces: `key` is the bucket
        // object key, `location` the full public URL persisted as `image`,
        // `bucket` the target bucket name.
        key: string;
        location: string;
        bucket?: string;
        buffer?: Buffer;
      };
    }
  }
}
