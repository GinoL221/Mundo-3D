import { Readable, PassThrough } from 'stream';
import type { Request } from 'express';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { createR2StorageEngine } from '../r2StorageEngine';
import { resetR2Client } from '../r2Client';

// Keep the real command classes (so `.input` and `instanceof` work) but swap
// the transport: never hit a real bucket. Mirrors design's Testing Strategy
// row — "S3Client.prototype.send mocked".
jest.mock('@aws-sdk/client-s3', () => {
  const actual = jest.requireActual('@aws-sdk/client-s3');
  return { __esModule: true, ...actual, S3Client: jest.fn() };
});

const sendMock = jest.fn();

interface EngineFile {
  originalname: string;
  mimetype: string;
  stream: NodeJS.ReadableStream;
  key?: string;
}

const req = {} as Request;

const handle = (
  engine: { _handleFile: (req: Request, file: EngineFile, cb: (err: unknown, info?: Record<string, unknown>) => void) => void },
  file: EngineFile
): Promise<{ err: unknown; info?: Record<string, unknown> }> =>
  new Promise((resolve) => {
    engine._handleFile(req, file, (err, info) => resolve({ err, info }));
  });

beforeEach(() => {
  process.env.R2_ENDPOINT = 'https://acct.r2.cloudflarestorage.com';
  process.env.R2_ACCESS_KEY_ID = 'test-access-key';
  process.env.R2_SECRET_ACCESS_KEY = 'test-secret-key';
  process.env.R2_BUCKET_NAME = 'test-bucket';
  process.env.R2_PUBLIC_URL_BASE = 'https://pub-test.r2.dev';
  (S3Client as unknown as jest.Mock).mockImplementation(() => ({ send: sendMock }));
  sendMock.mockReset();
  sendMock.mockResolvedValue({});
  resetR2Client();
});

describe('r2StorageEngine._handleFile', () => {
  it('uploads under a dest-namespaced uuid key preserving the original extension', async () => {
    const engine = createR2StorageEngine('products');
    const file: EngineFile = {
      originalname: 'photo.png',
      mimetype: 'image/png',
      stream: Readable.from([Buffer.from('fake-png-bytes')]),
    };

    const { err, info } = await handle(engine, file);

    expect(err).toBeFalsy();
    expect(sendMock).toHaveBeenCalledTimes(1);
    const command = sendMock.mock.calls[0][0];
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command.input.Bucket).toBe('test-bucket');
    expect(command.input.Key).toMatch(/^products\/[0-9a-f-]{36}\.png$/);
    expect(info?.key).toBe(command.input.Key);
  });

  it('sets ContentType from the validated mimetype, never inferred from the key suffix', async () => {
    const engine = createR2StorageEngine('products');
    // Adversarial: fileFilter's unanchored regex lets `evil.png.exe` through
    // when the mimetype also matches. The served content type must still be
    // the validated image type (design Threat Matrix row).
    const file: EngineFile = {
      originalname: 'evil.png.exe',
      mimetype: 'image/png',
      stream: Readable.from([Buffer.from('fake-bytes')]),
    };

    await handle(engine, file);

    const command = sendMock.mock.calls[0][0];
    expect(command.input.ContentType).toBe('image/png');
  });

  it('composes location from R2_PUBLIC_URL_BASE + "/" + key', async () => {
    const engine = createR2StorageEngine('products');
    const file: EngineFile = {
      originalname: 'photo.webp',
      mimetype: 'image/webp',
      stream: Readable.from([Buffer.from('bytes')]),
    };

    const { info } = await handle(engine, file);
    const command = sendMock.mock.calls[0][0];

    expect(info?.location).toBe(`https://pub-test.r2.dev/${command.input.Key}`);
  });

  it('never sends an ACL field (R2 has no per-object ACLs)', async () => {
    const engine = createR2StorageEngine('products');
    const file: EngineFile = {
      originalname: 'photo.jpg',
      mimetype: 'image/jpeg',
      stream: Readable.from([Buffer.from('bytes')]),
    };

    await handle(engine, file);

    const command = sendMock.mock.calls[0][0];
    expect(command.input).not.toHaveProperty('ACL');
  });

  it('propagates a PutObject rejection to the callback', async () => {
    sendMock.mockReset();
    sendMock.mockRejectedValue(new Error('R2 unreachable'));
    const engine = createR2StorageEngine('products');
    const file: EngineFile = {
      originalname: 'photo.png',
      mimetype: 'image/png',
      stream: Readable.from([Buffer.from('bytes')]),
    };

    const { err } = await handle(engine, file);

    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toBe('R2 unreachable');
  });

  it('does not issue a PutObject when the stream hits the multer size limit', async () => {
    const engine = createR2StorageEngine('products');
    const stream = new PassThrough();
    const file: EngineFile = {
      originalname: 'huge.png',
      mimetype: 'image/png',
      stream,
    };

    const pending = handle(engine, file);
    stream.emit('data', Buffer.from('partial'));
    stream.emit('limit');
    const { err } = await pending;

    expect(err).toBeInstanceOf(Error);
    expect(sendMock).not.toHaveBeenCalled();
  });
});

describe('r2StorageEngine._removeFile', () => {
  it('issues a DeleteObjectCommand for the recorded key', async () => {
    const engine = createR2StorageEngine('products');
    const file = { key: 'products/abc-123.png' } as EngineFile;

    await new Promise<void>((resolve, reject) => {
      (engine as unknown as {
        _removeFile: (req: Request, file: EngineFile, cb: (err: unknown) => void) => void;
      })._removeFile(req, file, (err) => (err ? reject(err) : resolve()));
    });

    expect(sendMock).toHaveBeenCalledTimes(1);
    const command = sendMock.mock.calls[0][0];
    expect(command).toBeInstanceOf(DeleteObjectCommand);
    expect(command.input).toEqual({ Bucket: 'test-bucket', Key: 'products/abc-123.png' });
  });
});
