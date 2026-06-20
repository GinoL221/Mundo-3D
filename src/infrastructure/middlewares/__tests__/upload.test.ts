import path from 'path';
import multer from 'multer';
import createUpload from '../upload';

// Mock multer
jest.mock('multer', () => {
  const mockDiskStorage = jest.fn((config) => config);
  const mockMulter = jest.fn((config) => ({
    storage: config.storage,
    limits: config.limits,
  })) as any;
  mockMulter.diskStorage = mockDiskStorage;
  return mockMulter;
});

describe('createUpload factory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns a configured multer instance with storage and limits', () => {
    const upload = createUpload('test-dest');

    expect(multer).toHaveBeenCalledWith(
      expect.objectContaining({
        limits: { fileSize: 5 * 1024 * 1024 }
      })
    );
    expect(multer.diskStorage).toHaveBeenCalledTimes(1);
    expect(upload).toBeDefined();
  });

  it('sets correct destination directory', () => {
    createUpload('test-dest');
    const diskStorageOptions = (multer.diskStorage as jest.Mock).mock.calls[0][0];
    const callback = jest.fn();

    diskStorageOptions.destination({} as any, {} as any, callback);

    const expectedPath = path.join(process.cwd(), 'public', 'img', 'test-dest');
    expect(callback).toHaveBeenCalledWith(null, expectedPath);
  });

  it('generates unique filename preserving extension', () => {
    createUpload('test-dest');
    const diskStorageOptions = (multer.diskStorage as jest.Mock).mock.calls[0][0];
    const callback = jest.fn();

    const file = { originalname: 'avatar.png' } as any;
    diskStorageOptions.filename({} as any, file, callback);

    expect(callback).toHaveBeenCalledWith(null, expect.stringMatching(/^[0-9a-f-]{36}\.png$/));
  });

  it('defines fileFilter to validate image formats and rejects invalid ones', () => {
    createUpload('test-dest');
    const multerOptions = (multer as unknown as jest.Mock).mock.calls[0][0];
    expect(multerOptions.fileFilter).toBeDefined();

    const callback = jest.fn();
    const file = { originalname: 'test.txt', mimetype: 'text/plain' } as any;
    multerOptions.fileFilter({} as any, file, callback);

    expect(callback).toHaveBeenCalledWith(expect.any(Error), false);
    expect(callback.mock.calls[0][0].message).toBe('Invalid file format or size limit exceeded');
  });

  it('allows valid image formats in fileFilter', () => {
    createUpload('test-dest');
    const multerOptions = (multer as unknown as jest.Mock).mock.calls[0][0];
    const callback = jest.fn();
    const file = { originalname: 'avatar.png', mimetype: 'image/png' } as any;
    multerOptions.fileFilter({} as any, file, callback);

    expect(callback).toHaveBeenCalledWith(null, true);
  });
});
