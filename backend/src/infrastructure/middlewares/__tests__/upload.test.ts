import multer from 'multer';
import createUpload from '../upload';
import { createR2StorageEngine } from '../../storage/r2StorageEngine';

// Mock multer: capture the options object it is constructed with.
jest.mock('multer', () => {
  const mockMulter = jest.fn((config) => ({
    storage: config.storage,
    limits: config.limits,
    fileFilter: config.fileFilter,
  })) as any;
  return mockMulter;
});

jest.mock('../../storage/r2StorageEngine', () => ({
  createR2StorageEngine: jest.fn((dest: string) => ({
    __engine: true,
    dest,
    _handleFile: jest.fn(),
    _removeFile: jest.fn(),
  })),
}));

describe('createUpload factory (R2 storage engine)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('builds the multer instance with the R2 storage engine namespaced by dest', () => {
    createUpload('products');

    expect(createR2StorageEngine).toHaveBeenCalledWith('products');
    const multerOptions = (multer as unknown as jest.Mock).mock.calls[0][0];
    expect(multerOptions.storage).toMatchObject({ __engine: true, dest: 'products' });
    expect(typeof multerOptions.storage._handleFile).toBe('function');
    expect(typeof multerOptions.storage._removeFile).toBe('function');
  });

  it('preserves the 5MB file-size limit after the engine swap', () => {
    createUpload('products');

    const multerOptions = (multer as unknown as jest.Mock).mock.calls[0][0];
    expect(multerOptions.limits).toEqual({ fileSize: 5 * 1024 * 1024 });
  });

  it('does not use multer.diskStorage anymore', () => {
    createUpload('products');

    expect((multer as unknown as { diskStorage?: unknown }).diskStorage).toBeUndefined();
  });

  it('keeps fileFilter rejecting a disallowed extension/MIME type', () => {
    createUpload('products');
    const multerOptions = (multer as unknown as jest.Mock).mock.calls[0][0];
    const callback = jest.fn();

    multerOptions.fileFilter({}, { originalname: 'notes.txt', mimetype: 'text/plain' }, callback);

    expect(callback).toHaveBeenCalledWith(expect.any(Error), false);
    expect(callback.mock.calls[0][0].message).toBe('Invalid file format or size limit exceeded');
  });

  it('keeps fileFilter accepting a valid image', () => {
    createUpload('products');
    const multerOptions = (multer as unknown as jest.Mock).mock.calls[0][0];
    const callback = jest.fn();

    multerOptions.fileFilter({}, { originalname: 'avatar.png', mimetype: 'image/png' }, callback);

    expect(callback).toHaveBeenCalledWith(null, true);
  });
});
