import { Request, Response, NextFunction } from 'express';
import requestLoggerMiddleware from '../requestLogger';
import { logger } from '../../logging/logger';

describe('requestLogger middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;
  let loggerInfoSpy: jest.SpyInstance;
  let finishCallback: () => void;

  beforeEach(() => {
    req = {
      method: 'GET',
      url: '/test-route',
      reqId: 'test-req-id'
    };
    
    // Stub res.on so we can intercept the 'finish' event callback
    res = {
      statusCode: 200,
      on: jest.fn().mockImplementation((event: string, callback: () => void) => {
        if (event === 'finish') {
          finishCallback = callback;
        }
        return res;
      })
    } as unknown as Partial<Response>;

    next = jest.fn();
    loggerInfoSpy = jest.spyOn(logger, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    loggerInfoSpy.mockRestore();
  });

  it('should call next and set up event listener for response finish', () => {
    requestLoggerMiddleware(req as Request, res as Response, next);

    expect(res.on).toHaveBeenCalledWith('finish', expect.any(Function));
    expect(next).toHaveBeenCalled();
  });

  it('should log request details on finish', () => {
    requestLoggerMiddleware(req as Request, res as Response, next);

    // Trigger the finish callback
    finishCallback();

    expect(loggerInfoSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        reqId: 'test-req-id',
        method: 'GET',
        url: '/test-route',
        status: 200,
        latencyMs: expect.any(Number)
      }),
      expect.stringContaining('GET /test-route 200')
    );
  });
});
