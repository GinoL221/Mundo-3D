import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { getJwtSecret } from '../security/JwtSecret';
import { AUTH_COOKIE } from '../security/cookieOptions';
import { Role } from '../../domain/Role';

interface DecodedToken {
  userId: number;
  email?: string;
  category?: string;
  idRole?: number;
}

export const apiAuthMiddleware = (req: Request, res: Response, next: NextFunction): void | Response => {
  const token = req.cookies?.[AUTH_COOKIE];

  if (!token) {
    return res.status(401).json({ error: 'Token de autenticación no proporcionado' });
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as DecodedToken;
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Token de autenticación inválido o expirado' });
  }
};

// The principal always comes from `req.user`, set by apiAuthMiddleware from
// the JWT cookie. This API has exactly one authentication path — there is no
// server-side session store to fall back to.
export const requireRoles = (...roles: Role[]) => (
  req: Request,
  res: Response,
  next: NextFunction
): void | Response => {
  const principal = req.user;

  if (!principal) {
    return res.status(401).json({ error: 'Autenticación requerida' });
  }

  if (!roles.includes(principal.idRole as Role)) {
    return res.status(403).json({ error: 'Acceso restringido' });
  }

  next();
};

export const adminGuard = requireRoles(Role.ADMIN);
