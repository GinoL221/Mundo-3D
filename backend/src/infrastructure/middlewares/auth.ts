import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { getJwtSecret } from '../security/JwtSecret';
import { Role } from '../../domain/Role';

export const isUser = (req: Request, res: Response, next: NextFunction): void => {
  if (res.locals.isLogged) {
    next();
  } else {
    res.redirect('/login');
  }
};

export const guestMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  if (req.session?.userLogged) {
    return res.redirect('/profile');
  }
  next();
};

export const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.session?.userLogged) {
    return res.redirect('/login');
  }
  next();
};

interface DecodedToken {
  userId: number;
  email?: string;
  category?: string;
  idRole?: number;
}

export const apiAuthMiddleware = (req: Request, res: Response, next: NextFunction): void | Response => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de autenticación no proporcionado' });
  }

  const token = authHeader.slice('Bearer '.length);

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as DecodedToken;
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Token de autenticación inválido o expirado' });
  }
};

export const requireRoles = (...roles: Role[]) => (
  req: Request,
  res: Response,
  next: NextFunction
): void | Response => {
  const principal = req.session?.userLogged || req.user;

  if (!principal) {
    return res.status(401).json({ error: 'Autenticación requerida' });
  }

  if (!roles.includes(principal.idRole as Role)) {
    return res.status(403).json({ error: 'Acceso restringido' });
  }

  next();
};

export const adminGuard = requireRoles(Role.ADMIN);
