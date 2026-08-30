import path from 'path';
import fs from 'fs';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { logger } from '../../logging/logger';
import { cleanupUploadedFile } from '../cleanupUploadedFile';
import { resetR2Client } from '../../storage/r2Client';

jest.mock('@aws-sdk/client-s3', () => {
  const actual = jest.requireActual('@aws-sdk/client-s3');
  return { __esModule: true, ...actual, S3Client: jest.fn() };
});

const sendMock = jest.fn();
const flush = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));
const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

describe('cleanupUploadedFile', () => {
  let loggerWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.R2_ENDPOINT = 'https://acct.r2.cloudflarestorage.com';
    process.env.R2_ACCESS_KEY_ID = 'test-access-key';
    process.env.R2_SECRET_ACCESS_KEY = 'test-secret-key';
    process.env.R2_BUCKET_NAME = 'test-bucket';
    (S3Client as unknown as jest.Mock).mockImplementation(() => ({ send: sendMock }));
    sendMock.mockReset();
    sendMock.mockResolvedValue({});
    resetR2Client();
    loggerWarnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    loggerWarnSpy.mockRestore();
    process.env.NODE_ENV = ORIGINAL_NODE_ENV;
  });

  it('does nothing when the key is falsy (legitimately no uploaded object)', () => {
    process.env.NODE_ENV = 'production';
    const unlinkSpy = jest.spyOn(fs.promises, 'unlink');

    cleanupUploadedFile(undefined);
    cleanupUploadedFile(null);
    cleanupUploadedFile('');

    expect(sendMock).not.toHaveBeenCalled();
    expect(unlinkSpy).not.toHaveBeenCalled();
    unlinkSpy.mockRestore();
  });

  it('returns undefined synchronously — callers never await it', () => {
    process.env.NODE_ENV = 'production';
    expect(cleanupUploadedFile('products/abc.png')).toBeUndefined();
  });

  describe('in production (R2 bucket)', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('issues exactly one DeleteObjectCommand for the given key', async () => {
      cleanupUploadedFile('products/abc-123.png');
      await flush();

      expect(sendMock).toHaveBeenCalledTimes(1);
      const command = sendMock.mock.calls[0][0];
      expect(command).toBeInstanceOf(DeleteObjectCommand);
      expect(command.input).toEqual({ Bucket: 'test-bucket', Key: 'products/abc-123.png' });
    });

    it('logs an upload_cleanup_failed warning and never throws when the delete rejects', async () => {
      sendMock.mockReset();
      sendMock.mockRejectedValue(new Error('R2 unreachable'));

      expect(() => cleanupUploadedFile('products/missing.png')).not.toThrow();
      await flush();

      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'upload_cleanup_failed',
          key: 'products/missing.png',
          bucket: 'test-bucket',
        }),
        expect.stringContaining('missing.png')
      );
    });
  });

  describe('outside production (local disk)', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'test';
    });

    it('unlinks the file resolved under public/img and never touches R2', async () => {
      const unlinkSpy = jest
        .spyOn(fs.promises, 'unlink')
        .mockResolvedValue(undefined as never);

      cleanupUploadedFile('users/xyz-789.webp');
      await flush();

      expect(sendMock).not.toHaveBeenCalled();
      expect(unlinkSpy).toHaveBeenCalledWith(
        path.join(process.cwd(), 'public', 'img', 'users/xyz-789.webp')
      );
      unlinkSpy.mockRestore();
    });

    it('logs an upload_cleanup_failed warning and never throws when the unlink rejects', async () => {
      const unlinkSpy = jest
        .spyOn(fs.promises, 'unlink')
        .mockRejectedValue(new Error('ENOENT'));

      expect(() => cleanupUploadedFile('products/missing.png')).not.toThrow();
      await flush();

      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'upload_cleanup_failed',
          key: 'products/missing.png',
        }),
        expect.stringContaining('missing.png')
      );
      unlinkSpy.mockRestore();
    });
  });
});
