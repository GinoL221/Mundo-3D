import { Request, Response, NextFunction } from 'express';
import { VerifyRememberTokenUseCase } from '../application/use-cases/VerifyRememberTokenUseCase';
import { SequelizeRememberTokenRepository } from '../infrastructure/repositories/SequelizeRememberTokenRepository';
import { SequelizeUserRepository } from '../infrastructure/repositories/SequelizeUserRepository';
import { Sha256TokenHasher } from '../infrastructure/security/Sha256TokenHasher';

const rememberTokenRepo = new SequelizeRememberTokenRepository();
const userRepo = new SequelizeUserRepository();
const tokenHasher = new Sha256TokenHasher();
const verifyRememberTokenUseCase = new VerifyRememberTokenUseCase(rememberTokenRepo, userRepo, tokenHasher);

const userLoggedMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  res.locals.isLogged = false;

  try {
    const session = (req as any).session;
    if (session && !session.userLogged) {
      if (req.signedCookies && req.signedCookies.remember_token) {
        const cookieValue = req.signedCookies.remember_token;
        const parts = cookieValue.split(':');
        if (parts.length === 2) {
          const [userIdStr, plainToken] = parts;
          const userId = parseInt(userIdStr, 10);

          const user = await verifyRememberTokenUseCase.execute(plainToken);
          if (user && user.IDUser === userId) {
            session.userLogged = user;
          } else {
            res.clearCookie('remember_token');
          }
        } else {
          res.clearCookie('remember_token');
        }
      } else if (req.cookies && req.cookies.remember_token) {
        res.clearCookie('remember_token');
      }
    }
  } catch (error) {
    console.error('Error al verificar remember_token:', error);
  }

  const session = (req as any).session;

  if (session && session.userLogged) {
    res.locals.isLogged = true;
    res.locals.userLogged = session.userLogged;
  }

  next();
};

export = userLoggedMiddleware;
