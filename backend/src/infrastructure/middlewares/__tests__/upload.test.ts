import multer from 'multer';
import fs from 'fs';
import os from 'os';
import path from 'path';
import createUpload from '../upload';
import { createR2StorageEngine } from '../../storage/r2StorageEngine';
import { createCloudinaryStorageEngine } from '../../storage/cloudinaryStorageEngine';

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
    // Stand in for multer's own disk write: hand back the info object it
    // would produce so the wrapper's augmentation can be asserted.
    _handleFile: jest.fn((_req, _file, cb) =>
      cb(null, {
        filename: 'gen-uuid.png',
        path: '/abs/public/img/products/gen-uuid.png',
        destination: '/abs/public/img/products',
        size: 1234,
      })
    ),
    _removeFile: jest.fn((_req, _file, cb) => cb(null)),
  }));
  return mockMulter;
});

jest.mock('../../storage/r2StorageEngine', () => ({
  createR2StorageEngine: jest.fn((dest: string) => ({
    __r2Engine: true,
    dest,
    _handleFile: jest.fn((_req, _file, cb) => cb(null, { key: `${dest}/r2.png`, location: 'https://r2/r2.png' })),
    _removeFile: jest.fn((_req, _file, cb) => cb(null)),
  })),
}));

jest.mock('../../storage/cloudinaryStorageEngine', () => ({
  createCloudinaryStorageEngine: jest.fn((dest: string) => ({
    __cloudinaryEngine: true,
    dest,
    _handleFile: jest.fn((_req, _file, cb) =>
      cb(null, { key: `${dest}/cld`, location: 'https://res.cloudinary.com/demo/image/upload/v1/cld.png' })
    ),
    _removeFile: jest.fn((_req, _file, cb) => cb(null)),
  })),
}));

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
const ORIGINAL_STORAGE_DRIVER = process.env.STORAGE_DRIVER;

describe('createUpload factory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = ORIGINAL_NODE_ENV;
    if (ORIGINAL_STORAGE_DRIVER === undefined) {
      delete process.env.STORAGE_DRIVER;
    } else {
      process.env.STORAGE_DRIVER = ORIGINAL_STORAGE_DRIVER;
    }
  });

  afterAll(() => {
    process.env.NODE_ENV = ORIGINAL_NODE_ENV;
    if (ORIGINAL_STORAGE_DRIVER === undefined) {
      delete process.env.STORAGE_DRIVER;
    } else {
      process.env.STORAGE_DRIVER = ORIGINAL_STORAGE_DRIVER;
    }
  });

  it('uses a local-disk-backed engine outside production when STORAGE_DRIVER is unset', () => {
    process.env.NODE_ENV = 'test';
    delete process.env.STORAGE_DRIVER;
    createUpload('products');
    const multerOptions = (multer as unknown as jest.Mock).mock.calls[0][0];

    expect(createR2StorageEngine).not.toHaveBeenCalled();
    expect(createCloudinaryStorageEngine).not.toHaveBeenCalled();
    expect(typeof multerOptions.storage._handleFile).toBe('function');
    expect(typeof multerOptions.storage._removeFile).toBe('function');

    const cb = jest.fn();
    multerOptions.storage._handleFile({}, {}, cb);
    expect((multer as unknown as { diskStorage: jest.Mock }).diskStorage).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith(
      null,
      expect.objectContaining({ key: 'products/gen-uuid.png', location: 'gen-uuid.png' })
    );
  });

  it('local engine augments the disk info with key and a BARE-filename location', () => {
    process.env.NODE_ENV = 'test';
    createUpload('products');
    const engine = (multer as unknown as jest.Mock).mock.calls[0][0].storage;

    const file: { key?: string; path?: string } = {};
    const cb = jest.fn();
    engine._handleFile({}, file, cb);

    // `key` carries the dest prefix (cleanup joins it under public/img);
    // `location` is the bare filename so resolveImageUrl maps it to exactly
    // `/img/products/gen-uuid.png` — not a doubled `/img/products//img/...`.
    expect(cb).toHaveBeenCalledWith(
      null,
      expect.objectContaining({ key: 'products/gen-uuid.png', location: 'gen-uuid.png' })
    );
    expect(file.key).toBe('products/gen-uuid.png');
    expect(file.path).toBe('/abs/public/img/products/gen-uuid.png');
  });

  it('local engine surfaces a disk write error to the callback', () => {
    process.env.NODE_ENV = 'test';
    (multer as unknown as { diskStorage: jest.Mock }).diskStorage.mockReturnValueOnce({
      _handleFile: (_req: unknown, _file: unknown, cb: (e: unknown) => void) =>
        cb(new Error('disk full')),
      _removeFile: jest.fn(),
    });
    createUpload('products');
    const engine = (multer as unknown as jest.Mock).mock.calls[0][0].storage;

    const cb = jest.fn();
    engine._handleFile({}, {}, cb);

    expect(cb).toHaveBeenCalledWith(expect.any(Error));
  });

  it('uses the R2 storage engine namespaced by dest in production when STORAGE_DRIVER is unset', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.STORAGE_DRIVER;
    createUpload('products');
    const multerOptions = (multer as unknown as jest.Mock).mock.calls[0][0];
    const cb = jest.fn();
    multerOptions.storage._handleFile({}, {}, cb);

    expect(createR2StorageEngine).toHaveBeenCalledWith('products');
    expect((multer as unknown as { diskStorage: jest.Mock }).diskStorage).not.toHaveBeenCalled();
    expect(cb).toHaveBeenCalledWith(null, expect.objectContaining({ key: 'products/r2.png' }));
  });

  it('dispatches to R2 when STORAGE_DRIVER=r2 explicitly even outside production', () => {
    process.env.NODE_ENV = 'test';
    process.env.STORAGE_DRIVER = 'r2';
    createUpload('products');
    const engine = (multer as unknown as jest.Mock).mock.calls[0][0].storage;
    const handleCb = jest.fn();
    const removeCb = jest.fn();

    engine._handleFile({}, {}, handleCb);
    engine._removeFile({}, { key: 'products/r2.png' }, removeCb);

    expect(createR2StorageEngine).toHaveBeenCalledWith('products');
    expect(handleCb).toHaveBeenCalledWith(null, expect.objectContaining({ key: 'products/r2.png' }));
    expect(removeCb).toHaveBeenCalledWith(null);
  });

  it('dispatches to Cloudinary when STORAGE_DRIVER=cloudinary', () => {
    process.env.NODE_ENV = 'production';
    process.env.STORAGE_DRIVER = 'cloudinary';
    createUpload('products');
    const engine = (multer as unknown as jest.Mock).mock.calls[0][0].storage;
    const handleCb = jest.fn();
    const removeCb = jest.fn();

    engine._handleFile({}, {}, handleCb);
    engine._removeFile({}, { key: 'products/cld' }, removeCb);

    expect(createCloudinaryStorageEngine).toHaveBeenCalledWith('products');
    expect(handleCb).toHaveBeenCalledWith(
      null,
      expect.objectContaining({ key: 'products/cld' })
    );
    expect(removeCb).toHaveBeenCalledWith(null);
  });

  it('rejects uploads with 503 and safely no-ops _removeFile when STORAGE_DRIVER=disabled', () => {
    process.env.NODE_ENV = 'production';
    process.env.STORAGE_DRIVER = 'disabled';
    createUpload('products');
    const engine = (multer as unknown as jest.Mock).mock.calls[0][0].storage;
    const handleCb = jest.fn();
    const removeCb = jest.fn();

    engine._handleFile({}, {}, handleCb);
    engine._removeFile({}, {}, removeCb);

    expect(handleCb).toHaveBeenCalledTimes(1);
    const err = handleCb.mock.calls[0][0] as Error & { statusCode?: number };
    expect(err).toBeInstanceOf(Error);
    expect(err.statusCode).toBe(503);
    expect(removeCb).toHaveBeenCalledWith(null);
  });

  it('stays lazy on createUpload and surfaces invalid STORAGE_DRIVER errors in _handleFile and _removeFile', () => {
    process.env.STORAGE_DRIVER = 'invalid-driver';
    expect(() => createUpload('products')).not.toThrow();
    const engine = (multer as unknown as jest.Mock).mock.calls[0][0].storage;

    const handleCb = jest.fn();
    const removeCb = jest.fn();
    engine._handleFile({}, {}, handleCb);
    engine._removeFile({}, {}, removeCb);

    expect(handleCb).toHaveBeenCalledWith(expect.any(Error));
    expect(removeCb).toHaveBeenCalledWith(expect.any(Error));
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

  it('rejects composite or unanchored extensions like .htmlpng or .phppng', () => {
    createUpload('products');
    const multerOptions = (multer as unknown as jest.Mock).mock.calls[0][0];
    const callback = jest.fn();

    multerOptions.fileFilter({}, { originalname: 'avatar.htmlpng', mimetype: 'image/png' }, callback);

    expect(callback).toHaveBeenCalledWith(expect.any(Error), false);
    expect(callback.mock.calls[0][0].message).toBe('Invalid file format or size limit exceeded');
  });

  it('rejects spoofed non-image MIME types containing image keywords as parameters', () => {
    createUpload('products');
    const multerOptions = (multer as unknown as jest.Mock).mock.calls[0][0];
    const callback = jest.fn();

    multerOptions.fileFilter(
      {},
      { originalname: 'avatar.png', mimetype: 'text/html; charset=utf-8; x=png' },
      callback
    );

    expect(callback).toHaveBeenCalledWith(expect.any(Error), false);
    expect(callback.mock.calls[0][0].message).toBe('Invalid file format or size limit exceeded');
  });

  it('respects UPLOAD_DIR environment override for local storage destination', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'upload-test-'));
    process.env.NODE_ENV = 'test';
    delete process.env.STORAGE_DRIVER;
    process.env.UPLOAD_DIR = tempDir;
    createUpload('products');
    const engine = (multer as unknown as jest.Mock).mock.calls[0][0].storage;
    engine._handleFile({}, {}, jest.fn());

    const diskStorageCalls = (multer.diskStorage as unknown as jest.Mock).mock.calls;
    const diskConfig = diskStorageCalls[diskStorageCalls.length - 1][0];

    const cb = jest.fn();
    diskConfig.destination({}, {}, cb);

    expect(cb).toHaveBeenCalledWith(null, path.join(tempDir, 'products'));
    expect(fs.existsSync(path.join(tempDir, 'products'))).toBe(true);

    const filenameCb = jest.fn();
    diskConfig.filename({}, { originalname: 'item.webp' }, filenameCb);
    expect(filenameCb).toHaveBeenCalledWith(null, expect.stringMatching(/^[0-9a-f-]{36}\.webp$/));

    const removeCb = jest.fn();
    engine._removeFile({}, { key: 'products/gen-uuid.png' }, removeCb);
    expect(removeCb).toHaveBeenCalledWith(null);

    delete process.env.UPLOAD_DIR;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
