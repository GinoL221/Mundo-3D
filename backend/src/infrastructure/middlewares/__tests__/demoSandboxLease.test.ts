import { NextFunction, Request, Response } from 'express';
import { createDemoSandboxLeaseMiddleware } from '../demoSandboxLease';

function setup(header: string | string[] | undefined, result: unknown = null) {
  const req = { headers: { 'x-demo-sandbox-lease': header } } as unknown as Request;
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as unknown as Response;
  const next = jest.fn() as NextFunction;
  const execute = jest.fn().mockResolvedValue(result);
  return { req, res, next, execute, middleware: createDemoSandboxLeaseMiddleware({ execute }) };
}

test.each([undefined, '', '   ', ['a', 'b'], 'a, b'])(
  'rejects missing or ambiguous lease header without validation',
  async (header) => {
    const { req, res, next, execute, middleware } = setup(header);
    await middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(execute).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
    expect(req.sandbox).toBeUndefined();
  },
);

test('rejects an invalid or expired lease without attaching a context', async () => {
  const { req, res, next, execute, middleware } = setup('lease-a');
  await middleware(req, res, next);
  expect(execute).toHaveBeenCalledWith('lease-a');
  expect(res.status).toHaveBeenCalledWith(401);
  expect(next).not.toHaveBeenCalled();
  expect(req.sandbox).toBeUndefined();
});

test('attaches the validated slot and continues for an active lease', async () => {
  const snapshot = {
    id: 'slot-a',
    leaseId: 'lease-a',
    status: 'leased',
    idleExpiresAt: new Date('2026-01-01'),
  };
  const { req, res, next, execute, middleware } = setup('lease-a', snapshot);
  await middleware(req, res, next);
  expect(execute).toHaveBeenCalledWith('lease-a');
  expect(req.sandbox).toEqual({
    slotId: 'slot-a',
    leaseId: 'lease-a',
    idleExpiresAt: snapshot.idleExpiresAt,
  });
  expect(next).toHaveBeenCalledWith();
  expect(res.status).not.toHaveBeenCalled();
});

test('forwards validator failures without attaching a context', async () => {
  const { req, res, next, execute, middleware } = setup('lease-a');
  const error = new Error('validation failed');
  execute.mockRejectedValue(error);
  await middleware(req, res, next);
  expect(next).toHaveBeenCalledWith(error);
  expect(req.sandbox).toBeUndefined();
  expect(res.status).not.toHaveBeenCalled();
});
