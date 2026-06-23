import jwt from 'jsonwebtoken';
import path from 'path';
import { Request, Response, NextFunction } from 'express';
import { getJwtSecret } from '../security/JwtSecret';
import { Role } from '../../domain/Role';

export const isUser = (req: Request, res: Response, next: NextFunction): void => {
  res.locals.isLogged ? next() : res.redirect('/login');
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

export const adminGuard = (req: Request, res: Response, next: NextFunction): void | Response => {
  const isApiRequest = req.path.startsWith('/api') || req.originalUrl?.startsWith('/api');
  const principal = req.session?.userLogged || req.user;

  if (!principal) {
    if (isApiRequest) {
      return res.status(401).json({ error: 'Autenticación requerida' });
    }
    return res.redirect('/login');
  }

  if (principal.idRole !== Role.ADMIN) {
    if (isApiRequest) {
      return res.status(403).json({ error: 'Acceso restringido a administradores' });
    }
    return res.status(403).render(path.join(__dirname, '../../views/403Forbidden.ejs'), {
      message: 'No tienes permisos de administrador para acceder a esta página.',
    });
  }

  next();
};
