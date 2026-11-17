import crypto from 'crypto';
import net from 'net';
import { NextFunction, Request, Response } from 'express';

const PROXY_SECRET_HEADER = 'x-proxy-secret';
const FORWARDED_CLIENT_IP_HEADER = 'x-forwarded-client-ip';

function timingSafeSecretEqual(expected: string, provided: string): boolean {
  const expectedBuf = Buffer.from(expected, 'utf8');
  const providedBuf = Buffer.from(provided, 'utf8');

  if (expectedBuf.length !== providedBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

/**
 * Trusts `X-Forwarded-Client-IP` only when `PROXY_SHARED_SECRET` is configured
 * and matches `X-Proxy-Secret` in constant time. Leaves `req.ip` untouched on
 * unauthenticated or invalid requests so direct calls cannot spoof rate-limit buckets.
 */
export function trustedProxyIp(req: Request, _res: Response, next: NextFunction): void {
  const configuredSecret = process.env.PROXY_SHARED_SECRET?.trim();
  if (!configuredSecret) {
    next();
    return;
  }

  const providedSecret = req.headers[PROXY_SECRET_HEADER];
  const rawForwardedIp = req.headers[FORWARDED_CLIENT_IP_HEADER];

  if (typeof providedSecret !== 'string' || typeof rawForwardedIp !== 'string') {
    next();
    return;
  }

  if (!timingSafeSecretEqual(configuredSecret, providedSecret)) {
    next();
    return;
  }

  const candidateIp = rawForwardedIp.trim();
  if (net.isIP(candidateIp) === 0) {
    next();
    return;
  }

  Object.defineProperty(req, 'ip', {
    value: candidateIp,
    configurable: true,
    enumerable: true,
  });

  next();
}

export default trustedProxyIp;
