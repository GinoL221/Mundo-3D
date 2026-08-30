import multer from 'multer';
import createUpload from '../upload';
import { createR2StorageEngine } from '../../storage/r2StorageEngine';

// Mock multer: capture the options object it is constructed with, and give it a
// `diskStorage` that returns a recognisable marker.
jest.mock('multer', () => {
  const mockMulter = jest.fn((config) => ({
    storage: config.storage,
    limits: config.limits,
    fileFilter: config.fileFilter,
  })) as any;
  mockMulter.diskStorage = jest.fn(() => ({
    __diskStorage: true,
    _handleFile: jest.fn(),
    _removeFile: jest.fn(),
  }));
  return mockMulter;
});

jest.mock('../../storage/r2StorageEngine', () => ({
  createR2StorageEngine: jest.fn((dest: string) => ({
    __r2Engine: true,
    dest,
    _handleFile: jest.fn(),
    _removeFile: jest.fn(),
  })),
}));

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

describe('createUpload factory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = ORIGINAL_NODE_ENV;
  });

  afterAll(() => {
    process.env.NODE_ENV = ORIGINAL_NODE_ENV;
  });

  it('uses a local-disk-backed engine outside production', () => {
    process.env.NODE_ENV = 'test';
    createUpload('products');

    expect(createR2StorageEngine).not.toHaveBeenCalled();
    expect((multer as unknown as { diskStorage: jest.Mock }).diskStorage).toHaveBeenCalledTimes(1);
    const multerOptions = (multer as unknown as jest.Mock).mock.calls[0][0];
    expect(typeof multerOptions.storage._handleFile).toBe('function');
    expect(typeof multerOptions.storage._removeFile).toBe('function');
  });

  it('uses the R2 storage engine namespaced by dest in production', () => {
    process.env.NODE_ENV = 'production';
    createUpload('products');

    expect(createR2StorageEngine).toHaveBeenCalledWith('products');
    expect((multer as unknown as { diskStorage: jest.Mock }).diskStorage).not.toHaveBeenCalled();
    const multerOptions = (multer as unknown as jest.Mock).mock.calls[0][0];
    expect(multerOptions.storage).toMatchObject({ __r2Engine: true, dest: 'products' });
  });

  it('preserves the 5MB file-size limit in both environments', () => {
    process.env.NODE_ENV = 'test';
    createUpload('products');
    expect((multer as unknown as jest.Mock).mock.calls[0][0].limits).toEqual({
      fileSize: 5 * 1024 * 1024,
    });

    jest.clearAllMocks();
    process.env.NODE_ENV = 'production';
    createUpload('products');
    expect((multer as unknown as jest.Mock).mock.calls[0][0].limits).toEqual({
      fileSize: 5 * 1024 * 1024,
    });
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
