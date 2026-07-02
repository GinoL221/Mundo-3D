import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import handleValidationErrors from '../handleValidationErrors';
import { cleanupUploadedFile } from '../../utils/cleanupUploadedFile';

jest.mock('express-validator', () => ({
  validationResult: jest.fn(),
}));

jest.mock('../../utils/cleanupUploadedFile', () => ({
  cleanupUploadedFile: jest.fn(),
}));

describe('handleValidationErrors', () => {
  let req: Omit<Partial<Request>, 'file'> & { file?: { path?: string } };
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { file: undefined };
    res = {
      status: jest.fn().mockReturnThis() as any,
      json: jest.fn().mockReturnThis() as any,
    };
    next = jest.fn();
  });

  it('calls next() and does not touch the filesystem when there are no validation errors', () => {
    (validationResult as unknown as jest.Mock).mockReturnValue({
      isEmpty: () => true,
      array: () => [],
    });

    handleValidationErrors(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(cleanupUploadedFile).not.toHaveBeenCalled();
  });

  it('returns 400 with the error list when validation fails, without touching the filesystem if no file was uploaded', () => {
    const errors = [{ msg: 'invalid' }];
    (validationResult as unknown as jest.Mock).mockReturnValue({
      isEmpty: () => false,
      array: () => errors,
    });

    handleValidationErrors(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ errors });
    expect(next).not.toHaveBeenCalled();
    expect(cleanupUploadedFile).not.toHaveBeenCalled();
  });

  it('cleans up an orphaned uploaded file when validation fails after multer already wrote it to disk', () => {
    req.file = { path: '/tmp/uploads/orphan.png' };
    (validationResult as unknown as jest.Mock).mockReturnValue({
      isEmpty: () => false,
      array: () => [{ msg: 'invalid' }],
    });

    handleValidationErrors(req as Request, res as Response, next);

    expect(cleanupUploadedFile).toHaveBeenCalledWith('/tmp/uploads/orphan.png');
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
