import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import crypto from 'crypto';
import { AuthenticateUserUseCase } from '../../application/use-cases/AuthenticateUserUseCase';
import { RegisterUserUseCase } from '../../application/use-cases/RegisterUserUseCase';
import { CreateRememberTokenUseCase } from '../../application/use-cases/CreateRememberTokenUseCase';
import { DeleteRememberTokenUseCase } from '../../application/use-cases/DeleteRememberTokenUseCase';
import { InvalidCredentialsException } from '../../domain/exceptions/InvalidCredentialsException';
import { UserAlreadyExistsException } from '../../domain/exceptions/UserAlreadyExistsException';

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

export class UserController {
  constructor(
    private readonly authenticateUserUseCase: AuthenticateUserUseCase,
    private readonly registerUserUseCase: RegisterUserUseCase,
    private readonly createRememberTokenUseCase: CreateRememberTokenUseCase,
    private readonly deleteRememberTokenUseCase: DeleteRememberTokenUseCase
  ) {}

  processLogin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        res.render('users/login', {
          errors: errors.mapped(),
          oldData: req.body.email,
        });
        return;
      }

      const { email, password, remember } = req.body;

      let userDto;
      try {
        userDto = await this.authenticateUserUseCase.execute({
          email: email,
          password: password,
        });
      } catch (error) {
        if (error instanceof InvalidCredentialsException) {
          res.render('users/login', {
            errors: {
              email: {
                msg: error.message,
              },
              password: {
                msg: error.message,
              },
            },
            oldData: req.body.email,
          });
          return;
        }
        throw error;
      }

      const userWithoutPassword = addLegacyGetters({
        idUser: userDto.idUser ?? (userDto as any).IDUser,
        firstName: userDto.firstName ?? (userDto as any).FirstName,
        lastName: userDto.lastName ?? (userDto as any).LastName,
        email: userDto.email ?? (userDto as any).Email,
        image: userDto.image ?? (userDto as any).Image,
        idRole: userDto.idRole ?? (userDto as any).IDRole,
        category: userDto.category ?? (userDto as any).Category,
      });

      (req as any).session.userLogged = userWithoutPassword;

      if (remember) {
        const plainToken = crypto.randomBytes(32).toString('hex');
        const durationSeconds = 30 * 24 * 60 * 60; // 30 days
        await this.createRememberTokenUseCase.execute({
          idUser: userDto.idUser,
          plainToken: plainToken,
          durationSeconds: durationSeconds,
        });

        res.cookie('remember_token', `${userDto.idUser}:${plainToken}`, {
          maxAge: durationSeconds * 1000,
          signed: true,
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
        });
      }

      res.redirect('profile');
    } catch (error) {
      console.error('Error al procesar el login:', error);
      next(error);
    }
  };

  postNewUser = async (req: Request & { file?: { filename: string } }, res: Response, next: NextFunction): Promise<void> => {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        res.render('users/register', {
          errors: errors.mapped(),
          oldData: req.body,
        });
        return;
      }

      if (!req.file) {
        throw new Error('Tienes que subir una imagen');
      }

      const { firstName, lastName, email, password } = req.body;
      const image = req.file.filename;

      try {
        await this.registerUserUseCase.execute({
          firstName: firstName,
          lastName: lastName,
          email: email,
          password: password,
          image: image,
        });
      } catch (error) {
        if (error instanceof UserAlreadyExistsException) {
          res.render('users/register', {
            errors: {
              email: { msg: error.message },
            },
            oldData: req.body,
          });
          return;
        }
        throw error;
      }

      res.redirect('/users');
    } catch (error) {
      console.error('Error en el controlador postNewUser:', error);
      next(error);
    }
  };

  logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (req.signedCookies && req.signedCookies.remember_token) {
        const cookieValue = req.signedCookies.remember_token;
        const parts = cookieValue.split(':');
        if (parts.length === 2) {
          const plainToken = parts[1];
          await this.deleteRememberTokenUseCase.execute(plainToken);
        }
      }
    } catch (error) {
      console.error('Error deleting remember token on logout:', error);
    }

    res.clearCookie('remember_token');

    if ((req as any).session) {
      (req as any).session.destroy((err: any) => {
        if (err) {
          console.error('Error destroying session:', err);
          res.redirect('/');
        } else {
          res.redirect('/');
        }
      });
    } else {
      res.redirect('/');
    }
  };
}
