import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export default function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const headerName = 'x-request-id';
  let reqId = req.headers[headerName];

  if (Array.isArray(reqId)) {
    reqId = reqId[0];
  }

  if (!reqId) {
    reqId = uuidv4();
  }

  req.reqId = reqId;
  res.setHeader(headerName, reqId);
  next();
}
