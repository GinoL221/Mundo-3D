import fs from 'fs';
import { logger } from '../../logging/logger';
import { cleanupUploadedFile } from '../cleanupUploadedFile';

jest.mock('fs');

describe('cleanupUploadedFile', () => {
  let loggerWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    loggerWarnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    loggerWarnSpy.mockRestore();
  });

  it('does nothing when no file path is provided', () => {
    cleanupUploadedFile(undefined);

    expect(fs.unlink).not.toHaveBeenCalled();
  });

  it('calls fs.unlink with the given path', () => {
    (fs.unlink as unknown as jest.Mock).mockImplementation((_path, cb) => cb(null));

    cleanupUploadedFile('/tmp/upload/orphan.png');

    expect(fs.unlink).toHaveBeenCalledWith('/tmp/upload/orphan.png', expect.any(Function));
  });

  it('logs a warning but does not throw when unlink itself fails', () => {
    const unlinkError = new Error('ENOENT: no such file');
    (fs.unlink as unknown as jest.Mock).mockImplementation((_path, cb) => cb(unlinkError));

    expect(() => cleanupUploadedFile('/tmp/upload/missing.png')).not.toThrow();
    expect(loggerWarnSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'upload_cleanup_failed',
        filePath: '/tmp/upload/missing.png',
      }),
      expect.stringContaining('missing.png')
    );
  });
});
