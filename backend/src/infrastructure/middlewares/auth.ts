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
  typ?: string;
}

export const apiAuthMiddleware = (req: Request, res: Response, next: NextFunction): void | Response => {
  const token = req.cookies?.[AUTH_COOKIE];

  if (!token) {
    return res.status(401).json({ error: 'Token de autenticación no proporcionado' });
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as DecodedToken;

    // api-jwt-auth spec: "Pre-deploy JWT without typ claim is rejected" —
    // required in exactly this one place (design.md D3). A validly-signed,
    // unexpired token that lacks `typ: 'access'` (pre-deploy JWTs, or a
    // refresh-typed value) is rejected, making the deploy cutover
    // deterministic and testable rather than hoped-for.
    if (decoded.typ !== 'access') {
      return res.status(401).json({ error: 'Token de autenticación inválido o expirado' });
    }

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
