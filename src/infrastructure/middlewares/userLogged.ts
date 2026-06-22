import { Request, Response, NextFunction } from 'express';
import { VerifyRememberTokenUseCase } from '../../application/use-cases/VerifyRememberTokenUseCase';
import { SequelizeRememberTokenRepository } from '../repositories/SequelizeRememberTokenRepository';
import { SequelizeUserRepository } from '../repositories/SequelizeUserRepository';
import { Sha256TokenHasher } from '../security/Sha256TokenHasher';
import { UserDTO } from '../../application/dtos/UserDTO';

const rememberTokenRepo = new SequelizeRememberTokenRepository();
const userRepo = new SequelizeUserRepository();
const tokenHasher = new Sha256TokenHasher();
const verifyRememberTokenUseCase = new VerifyRememberTokenUseCase(rememberTokenRepo, userRepo, tokenHasher);

function addLegacyGetters(obj: any): any {
  if (!obj) return obj;
  const mappings: Record<string, string> = {
    IDUser: 'idUser',
    IDRole: 'idRole',
    FirstName: 'firstName',
    LastName: 'lastName',
    Email: 'email',
    Image: 'image',
    Category: 'category'
  };
  for (const [legacyKey, newKey] of Object.entries(mappings)) {
    if (newKey in obj && !(legacyKey in obj)) {
      Object.defineProperty(obj, legacyKey, {
        get() { return this[newKey]; },
        configurable: true,
        enumerable: false
      });
    }
  }
  return obj;
}

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
          if (user && user.idUser === userId) {
            session.userLogged = user as Partial<UserDTO> & Record<string, unknown>;
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
    const logged = session.userLogged as Partial<UserDTO> & Record<string, unknown>;
    const baseObj = {
      idUser: logged.idUser ?? logged.IDUser,
      firstName: logged.firstName ?? logged.FirstName,
      lastName: logged.lastName ?? logged.LastName,
      email: logged.email ?? logged.Email,
      image: logged.image ?? logged.Image,
      idRole: logged.idRole ?? logged.IDRole,
      category: logged.category ?? logged.Category,
    };
    session.userLogged = addLegacyGetters(baseObj) as Partial<UserDTO> & Record<string, unknown>;
    res.locals.isLogged = true;
    res.locals.userLogged = session.userLogged;
  }

  next();
};

export = userLoggedMiddleware;
