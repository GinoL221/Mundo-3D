import { S3Client } from '@aws-sdk/client-s3';

// Lazy singleton. `createUpload('products')` runs at module load in
// `routes/api/products.ts`, so reading the R2_* env vars at construction time
// would break every test that imports the router. The client is built on first
// real use instead — the same lazy discipline the config precedent forced.
let client: S3Client | null = null;

export function getR2Client(): S3Client {
  if (!client) {
    client = new S3Client({
      region: 'auto',
      endpoint: process.env.R2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID as string,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY as string,
      },
    });
  }
  return client;
}

export function getBucket(): string {
  return process.env.R2_BUCKET_NAME as string;
}

// Public host URL for a stored object key. R2's public host
// (pub-<hash>.r2.dev or a custom domain) is never the S3 API endpoint, so this
// is composed from a dedicated var. Trailing slash on the base is tolerated.
export function publicUrlFor(key: string): string {
  const base = (process.env.R2_PUBLIC_URL_BASE ?? '').replace(/\/$/, '');
  return `${base}/${key}`;
}

// Test seam: drop the cached client so a fresh set of env vars takes effect.
export function resetR2Client(): void {
  client = null;
}
