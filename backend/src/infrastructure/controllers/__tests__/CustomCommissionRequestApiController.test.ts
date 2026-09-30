import { CustomCommissionRequestApiController } from '../CustomCommissionRequestApiController';
import { SelectedProductNotFoundException } from '../../../domain/exceptions/SelectedProductNotFoundException';

describe('CustomCommissionRequestApiController', () => {
  const request = { idCustomCommissionRequest: 9, name: 'Private Name', email: 'private@example.com', idea: 'Private idea', idProduct: null, createdAt: new Date('2026-09-01T00:00:00Z'), expiresAt: new Date('2026-10-01T00:00:00Z') };
  it('returns only receipt metadata after creation', async () => {
    const create = { execute: jest.fn().mockResolvedValue(request) };
    const controller = new CustomCommissionRequestApiController(create as any, {} as any);
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;
    await controller.create({ body: { name: request.name, email: request.email, idea: request.idea } } as any, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json.mock.calls[0][0]).toEqual({ idCustomCommissionRequest: 9, createdAt: request.createdAt, expiresAt: request.expiresAt });
    expect(JSON.stringify(res.json.mock.calls[0][0])).not.toMatch(/Private Name|private@example.com|Private idea/);
  });

  it('returns a clear client error when a selected product does not exist', async () => {
    const create = { execute: jest.fn().mockRejectedValue(new SelectedProductNotFoundException()) };
    const controller = new CustomCommissionRequestApiController(create as any, {} as any);
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;
    await controller.create({ body: { name: 'Ari', email: 'ari@example.com', idea: 'Dragon', idProduct: 999 } } as any, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error).toMatch(/product does not exist/i);
  });

  it('passes unexpected errors to the error handler without logging request PII', async () => {
    const error = new Error('failure');
    const create = { execute: jest.fn().mockRejectedValue(error) };
    const controller = new CustomCommissionRequestApiController(create as any, {} as any);
    const next = jest.fn();
    await controller.create({ body: { name: 'Private Name', email: 'private@example.com', idea: 'Private idea' } } as any, {} as any, next);
    expect(next).toHaveBeenCalledWith(error);
  });
});
