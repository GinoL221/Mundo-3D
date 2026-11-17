export type StorageDriver = 'r2' | 'cloudinary' | 'disabled' | 'local';

const EXPLICIT_DRIVERS = new Set<string>(['r2', 'cloudinary', 'disabled']);

export function resolveStorageDriver(env: NodeJS.ProcessEnv = process.env): StorageDriver {
  const raw = (env.STORAGE_DRIVER ?? '').trim();
  if (raw.length > 0) {
    const normalized = raw.toLowerCase();
    if (EXPLICIT_DRIVERS.has(normalized)) {
      return normalized as 'r2' | 'cloudinary' | 'disabled';
    }
    throw new Error(
      `Invalid STORAGE_DRIVER "${raw}". Expected one of: r2, cloudinary, disabled.`
    );
  }

  return env.NODE_ENV === 'production' ? 'r2' : 'local';
}
