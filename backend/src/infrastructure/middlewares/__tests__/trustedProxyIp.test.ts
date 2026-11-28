import { NextFunction, Request, Response } from 'express';
import trustedProxyIp from '../trustedProxyIp';

function createReq(
  headers: Record<string, string | string[] | undefined>,
  initialIp = '127.0.0.1',
): Request {
  const req = {
    headers,
  } as unknown as Request;
  Object.defineProperty(req, 'ip', {
    value: initialIp,
    configurable: true,
    enumerable: true,
  });
  return req;
}

describe('trustedProxyIp middleware', () => {
  const ORIGINAL_SECRET = process.env.PROXY_SHARED_SECRET;
  let res: Response;
  let next: NextFunction;

  beforeEach(() => {
    delete process.env.PROXY_SHARED_SECRET;
    res = {} as Response;
    next = jest.fn();
  });

  afterEach(() => {
    if (ORIGINAL_SECRET === undefined) {
      delete process.env.PROXY_SHARED_SECRET;
    } else {
      process.env.PROXY_SHARED_SECRET = ORIGINAL_SECRET;
    }
  });

  it('calls next() without changing req.ip when PROXY_SHARED_SECRET is unset', () => {
    const req = createReq(
      {
        'x-proxy-secret': 'some-secret',
        'x-forwarded-client-ip': '203.0.113.50',
      },
      '10.0.0.1',
    );

    trustedProxyIp(req, res, next);

    expect(req.ip).toBe('10.0.0.1');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('calls next() without changing req.ip when PROXY_SHARED_SECRET is empty', () => {
    process.env.PROXY_SHARED_SECRET = '   ';
    const req = createReq(
      {
        'x-proxy-secret': '   ',
        'x-forwarded-client-ip': '203.0.113.50',
      },
      '10.0.0.1',
    );

    trustedProxyIp(req, res, next);

    expect(req.ip).toBe('10.0.0.1');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('leaves req.ip untouched when x-proxy-secret header is missing or non-string', () => {
    process.env.PROXY_SHARED_SECRET = 'super-secret-value';

    const reqMissing = createReq({ 'x-forwarded-client-ip': '203.0.113.50' }, '10.0.0.2');
    trustedProxyIp(reqMissing, res, next);
    expect(reqMissing.ip).toBe('10.0.0.2');

    const reqArray = createReq(
      {
        'x-proxy-secret': ['super-secret-value'],
        'x-forwarded-client-ip': '203.0.113.50',
      },
      '10.0.0.3',
    );
    trustedProxyIp(reqArray, res, next);
    expect(reqArray.ip).toBe('10.0.0.3');
    expect(next).toHaveBeenCalledTimes(2);
  });

  it('leaves req.ip untouched when x-proxy-secret does not match (different or equal length)', () => {
    process.env.PROXY_SHARED_SECRET = 'super-secret-value';

    const reqShort = createReq(
      {
        'x-proxy-secret': 'short',
        'x-forwarded-client-ip': '203.0.113.50',
      },
      '10.0.0.4',
    );
    trustedProxyIp(reqShort, res, next);
    expect(reqShort.ip).toBe('10.0.0.4');

    const reqSameLen = createReq(
      {
        'x-proxy-secret': 'super-secret-valuX',
        'x-forwarded-client-ip': '203.0.113.50',
      },
      '10.0.0.5',
    );
    trustedProxyIp(reqSameLen, res, next);
    expect(reqSameLen.ip).toBe('10.0.0.5');
    expect(next).toHaveBeenCalledTimes(2);
  });

  it('leaves req.ip untouched when x-forwarded-client-ip is missing, non-string, or invalid IP', () => {
    process.env.PROXY_SHARED_SECRET = 'super-secret-value';

    const invalidCandidates: Array<string | string[] | undefined> = [
      undefined,
      ['203.0.113.50'],
      '',
      '   ',
      'not-an-ip',
      '203.0.113.50:8080',
      '999.999.999.999',
    ];

    for (const candidate of invalidCandidates) {
      const req = createReq(
        {
          'x-proxy-secret': 'super-secret-value',
          'x-forwarded-client-ip': candidate,
        },
        '10.0.0.6',
      );
      trustedProxyIp(req, res, next);
      expect(req.ip).toBe('10.0.0.6');
    }

    expect(next).toHaveBeenCalledTimes(invalidCandidates.length);
  });

  it('overrides req.ip with trimmed IPv4 when secret matches and IP is valid', () => {
    process.env.PROXY_SHARED_SECRET = 'super-secret-value';
    const req = createReq(
      {
        'x-proxy-secret': 'super-secret-value',
        'x-forwarded-client-ip': '  203.0.113.50  ',
      },
      '10.0.0.7',
    );

    trustedProxyIp(req, res, next);

    expect(req.ip).toBe('203.0.113.50');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('overrides req.ip with IPv6 when secret matches and IPv6 is valid', () => {
    process.env.PROXY_SHARED_SECRET = 'super-secret-value';
    const req = createReq(
      {
        'x-proxy-secret': 'super-secret-value',
        'x-forwarded-client-ip': '2001:db8::1',
      },
      '10.0.0.8',
    );

    trustedProxyIp(req, res, next);

    expect(req.ip).toBe('2001:db8::1');
    expect(next).toHaveBeenCalledTimes(1);
  });
});
