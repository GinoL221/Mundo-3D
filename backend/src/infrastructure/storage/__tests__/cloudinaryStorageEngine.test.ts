import { Readable, PassThrough } from 'stream';
import type { Request } from 'express';
import { createHash } from 'node:crypto';
import { resolveStorageDriver } from '../storageDriver';
import { signCloudinaryParams, destroyCloudinaryImage } from '../cloudinaryClient';
import { createCloudinaryStorageEngine } from '../cloudinaryStorageEngine';

interface EngineFile {
  originalname: string;
  mimetype: string;
  stream: NodeJS.ReadableStream;
  key?: string;
}

const req = {} as Request;

const handle = (
  engine: {
    _handleFile: (
      req: Request,
      file: EngineFile,
      cb: (err: unknown, info?: Record<string, unknown>) => void,
    ) => void;
  },
  file: EngineFile,
): Promise<{ err: unknown; info?: Record<string, unknown> }> =>
  new Promise((resolve) => {
    engine._handleFile(req, file, (err, info) => resolve({ err, info }));
  });

const remove = (
  engine: {
    _removeFile: (req: Request, file: EngineFile, cb: (err: unknown) => void) => void;
  },
  file: EngineFile,
): Promise<unknown> =>
  new Promise((resolve) => {
    engine._removeFile(req, file, (err) => resolve(err));
  });

describe('resolveStorageDriver', () => {
  it('defaults to r2 in production when STORAGE_DRIVER is unset or empty', () => {
    expect(resolveStorageDriver({ NODE_ENV: 'production' })).toBe('r2');
    expect(resolveStorageDriver({ NODE_ENV: 'production', STORAGE_DRIVER: '   ' })).toBe('r2');
  });

  it('defaults to local outside production when STORAGE_DRIVER is unset or empty', () => {
    expect(resolveStorageDriver({ NODE_ENV: 'test' })).toBe('local');
    expect(resolveStorageDriver({ NODE_ENV: 'development' })).toBe('local');
    expect(resolveStorageDriver({})).toBe('local');
  });

  it('accepts r2, cloudinary, and disabled case-insensitively with trimming', () => {
    expect(resolveStorageDriver({ STORAGE_DRIVER: 'r2' })).toBe('r2');
    expect(resolveStorageDriver({ STORAGE_DRIVER: ' CLOUDINARY ' })).toBe('cloudinary');
    expect(resolveStorageDriver({ STORAGE_DRIVER: 'Disabled' })).toBe('disabled');
  });

  it('throws an explicit error on an unknown STORAGE_DRIVER value', () => {
    expect(() => resolveStorageDriver({ STORAGE_DRIVER: 's3-typo' })).toThrow(/STORAGE_DRIVER/);
  });
});

describe('signCloudinaryParams', () => {
  it('sorts parameters alphabetically, joins with &, appends apiSecret, and hashes with SHA-1', () => {
    const sig = signCloudinaryParams(
      { timestamp: 1700000000, public_id: 'products/abc', folder: 'ignored-order' },
      'my-secret',
    );
    const expected = createHash('sha1')
      .update('folder=ignored-order&public_id=products/abc&timestamp=1700000000my-secret')
      .digest('hex');
    expect(sig).toBe(expected);
  });
});

describe('cloudinaryStorageEngine', () => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };
  let fetchMock: jest.Mock;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      CLOUDINARY_CLOUD_NAME: 'demo-cloud',
      CLOUDINARY_API_KEY: 'demo-key',
      CLOUDINARY_API_SECRET: 'demo-secret',
    };
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = originalEnv;
  });

  it('uploads signed multipart form data and returns key, secure_url, and size', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        public_id: 'products/server-id',
        secure_url: 'https://res.cloudinary.com/demo-cloud/image/upload/v1/products/server-id.png',
        bytes: 42,
      }),
    });

    const engine = createCloudinaryStorageEngine('products');
    const file: EngineFile = {
      originalname: 'photo.png',
      mimetype: 'image/png',
      stream: Readable.from([Buffer.from('fake-png-bytes')]),
    };

    const { err, info } = await handle(engine, file);

    expect(err).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.cloudinary.com/v1_1/demo-cloud/image/upload');
    expect(init.method).toBe('POST');
    expect(init.body).toBeInstanceOf(FormData);

    const formData = init.body as FormData;
    expect(formData.get('api_key')).toBe('demo-key');
    expect(String(formData.get('public_id'))).toMatch(/^products\/[0-9a-f-]{36}$/);
    expect(formData.get('signature')).toMatch(/^[0-9a-f]{40}$/);
    expect(formData.get('file')).toBeInstanceOf(Blob);

    expect(file.key).toBe('products/server-id');
    expect(info).toEqual({
      key: 'products/server-id',
      location: 'https://res.cloudinary.com/demo-cloud/image/upload/v1/products/server-id.png',
      size: 42,
    });
  });

  it('falls back to generated publicId and buffer length when response omits public_id/bytes', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        secure_url: 'https://res.cloudinary.com/demo-cloud/image/upload/v1/fallback.png',
      }),
    });

    const engine = createCloudinaryStorageEngine('users');
    const payload = Buffer.from('hello-world');
    const file: EngineFile = {
      originalname: 'avatar.png',
      mimetype: 'image/png',
      stream: Readable.from([payload]),
    };

    const { err, info } = await handle(engine, file);

    expect(err).toBeNull();
    expect(info?.key).toMatch(/^users\/[0-9a-f-]{36}$/);
    expect(info?.size).toBe(payload.length);
  });

  it('passes an Error to cb when Cloudinary returns non-OK HTTP status', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Invalid signature',
    });

    const engine = createCloudinaryStorageEngine('products');
    const file: EngineFile = {
      originalname: 'photo.png',
      mimetype: 'image/png',
      stream: Readable.from([Buffer.from('bytes')]),
    };

    const { err } = await handle(engine, file);

    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toMatch(/401/);
  });

  it('passes an Error to cb when Cloudinary response is missing secure_url or non-object', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ public_id: 'products/123' }),
    });

    const engine = createCloudinaryStorageEngine('products');
    const file: EngineFile = {
      originalname: 'photo.png',
      mimetype: 'image/png',
      stream: Readable.from([Buffer.from('bytes')]),
    };

    const { err } = await handle(engine, file);

    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toMatch(/secure_url/);

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => null,
    });
    const nullRes = await handle(engine, {
      originalname: 'photo.png',
      mimetype: 'image/png',
      stream: Readable.from([Buffer.from('bytes')]),
    });
    expect(nullRes.err).toBeInstanceOf(Error);
    expect((nullRes.err as Error).message).toMatch(/secure_url/);
  });

  it('does not call fetch when stream emits limit or error, and ignores duplicate events after settling', async () => {
    const engine = createCloudinaryStorageEngine('products');
    const stream = new PassThrough();
    const file: EngineFile = {
      originalname: 'huge.png',
      mimetype: 'image/png',
      stream,
    };

    const pending = handle(engine, file);
    stream.emit('data', Buffer.from('partial'));
    stream.emit('limit');
    stream.emit('error', new Error('late error'));
    stream.emit('end');
    const { err } = await pending;

    expect(err).toBeInstanceOf(Error);
    expect(fetchMock).not.toHaveBeenCalled();

    const errStream = new PassThrough();
    const errPending = handle(engine, {
      originalname: 'broken.png',
      mimetype: 'image/png',
      stream: errStream,
    });
    errStream.emit('error', new Error('stream failure'));
    const errRes = await errPending;
    expect(errRes.err).toBeInstanceOf(Error);
  });

  it('fails when any required CLOUDINARY_* env var is missing', async () => {
    for (const envKey of ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']) {
      const saved = process.env[envKey];
      delete process.env[envKey];
      const engine = createCloudinaryStorageEngine('products');
      const file: EngineFile = {
        originalname: 'photo.png',
        mimetype: 'image/png',
        stream: Readable.from([Buffer.from('bytes')]),
      };

      const { err } = await handle(engine, file);

      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toMatch(new RegExp(envKey));
      expect(fetchMock).not.toHaveBeenCalled();
      process.env[envKey] = saved;
    }
  });

  it('_removeFile calls destroyCloudinaryImage and succeeds on ok response', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ result: 'ok' }) });
    const engine = createCloudinaryStorageEngine('products');

    const err = await remove(engine, {
      originalname: 'a.png',
      mimetype: 'image/png',
      stream: Readable.from([]),
      key: 'products/abc',
    });

    expect(err).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.cloudinary.com/v1_1/demo-cloud/image/destroy',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('destroyCloudinaryImage throws on non-OK response and _removeFile forwards error', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, text: async () => 'server error' });
    await expect(destroyCloudinaryImage('products/abc')).rejects.toThrow(/500/);

    const engine = createCloudinaryStorageEngine('products');
    const err = await remove(engine, {
      originalname: 'a.png',
      mimetype: 'image/png',
      stream: Readable.from([]),
      key: 'products/abc',
    });
    expect(err).toBeInstanceOf(Error);
  });
});
