import { NextFunction, Request, Response } from 'express';
import { ValidateDemoSandboxLeaseUseCase } from '../../application/use-cases/ValidateDemoSandboxLeaseUseCase';

/** Isolated middleware; it does not route requests or scope authentication. */
export function createDemoSandboxLeaseMiddleware(
  validator: Pick<ValidateDemoSandboxLeaseUseCase, 'execute'>,
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    delete req.sandbox;
    const leaseId = req.headers['x-demo-sandbox-lease'];
    if (typeof leaseId !== 'string' || !leaseId.trim() || leaseId.includes(',')) {
      res.status(401).json({ error: 'Demo sandbox lease required' });
      return;
    }
    try {
      const slot = await validator.execute(leaseId);
      if (
        !slot ||
        slot.status !== 'leased' ||
        slot.leaseId !== leaseId ||
        !slot.id ||
        !slot.idleExpiresAt
      ) {
        res.status(401).json({ error: 'Demo sandbox lease invalid or expired' });
        return;
      }
      req.sandbox = { slotId: slot.id, leaseId, idleExpiresAt: slot.idleExpiresAt };
      next();
    } catch (error) {
      next(error);
    }
  };
}
