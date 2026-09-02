import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthenticateUserUseCase } from '../../application/use-cases/AuthenticateUserUseCase';
import { ListUsersUseCase } from '../../application/use-cases/ListUsersUseCase';
import { GetUserByIdUseCase } from '../../application/use-cases/GetUserByIdUseCase';
import { RegisterUserUseCase } from '../../application/use-cases/RegisterUserUseCase';
import { CreateRememberTokenUseCase } from '../../application/use-cases/CreateRememberTokenUseCase';
import { RefreshSessionUseCase } from '../../application/use-cases/RefreshSessionUseCase';
import { RevokeRefreshTokenUseCase } from '../../application/use-cases/RevokeRefreshTokenUseCase';
import { InvalidCredentialsException } from '../../domain/exceptions/InvalidCredentialsException';
import { UserAlreadyExistsException } from '../../domain/exceptions/UserAlreadyExistsException';
import { cleanupUploadedFile } from '../utils/cleanupUploadedFile';
import { getJwtSecret } from '../security/JwtSecret';
import { AUTH_COOKIE, REFRESH_COOKIE, authMaxAge } from '../security/cookieOptions';
import {
  setSessionCookies,
  clearSessionCookies,
  issueAccessCookie,
  issueRefreshCookie,
  generateRefreshToken,
} from './sessionCookies';

interface UserAuthDto {
  idUser: number;
  firstName: string;
  lastName: string;
  email: string;
  image: string | null;
  idRole?: number | null;
  category?: string | null;
}

export class UserApiController {
  constructor(
    private readonly authenticateUserUseCase: AuthenticateUserUseCase,
    private readonly listUsersUseCase: ListUsersUseCase,
    private readonly getUserByIdUseCase: GetUserByIdUseCase,
    private readonly registerUserUseCase?: RegisterUserUseCase,
    private readonly createRememberTokenUseCase?: CreateRememberTokenUseCase,
    private readonly refreshSessionUseCase?: RefreshSessionUseCase,
    private readonly revokeRefreshTokenUseCase?: RevokeRefreshTokenUseCase
  ) {}

  // Shared by login/register (task 2.16): creates the RememberToken row and
  // issues all 4 session cookies, embedding familyId in the access JWT so
  // logout can revoke it later without needing the path-scoped refresh
  // cookie (see sessionCookies.ts's JwtPayload comment).
  private async establishSession(res: Response, userDto: UserAuthDto, remember?: boolean): Promise<void> {
    if (!this.createRememberTokenUseCase) {
      throw new Error('CreateRememberTokenUseCase not injected');
    }

    const refreshPlainToken = generateRefreshToken();
    const rememberToken = await this.createRememberTokenUseCase.execute({
      idUser: userDto.idUser,
      plainToken: refreshPlainToken,
      durationSeconds: authMaxAge(remember) / 1000,
    });

    const payload = {
      userId: userDto.idUser,
      email: userDto.email,
      category: userDto.category,
      idRole: userDto.idRole,
      familyId: rememberToken.familyId ?? undefined,
    };

    setSessionCookies(
      res,
      userDto.idUser,
      payload,
      { firstName: userDto.firstName, image: userDto.image, idRole: userDto.idRole, category: userDto.category },
      refreshPlainToken,
      remember
    );
  }

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const email = req.body.Email || req.body.email;
      const password = req.body.Password || req.body.password;
      const remember = req.body.remember === true || req.body.remember === 'true';

      const userDto = await this.authenticateUserUseCase.execute({ email, password });
      await this.establishSession(res, userDto, remember);

      res.json({
        user: {
          idUser: userDto.idUser,
          firstName: userDto.firstName,
          lastName: userDto.lastName,
          email: userDto.email,
          image: userDto.image,
          idRole: userDto.idRole,
          category: userDto.category,
        }
      });
    } catch (error) {
      if (error instanceof InvalidCredentialsException) {
        res.status(401).json({ error: 'El email o la contraseña no coinciden' });
        return;
      }
      next(error);
    }
  };

  // No apiAuthMiddleware ahead of this route (design.md D5) — logout must
  // succeed even with an absent/expired/invalid auth cookie. The familyId
  // claim is only trusted after jwt.verify succeeds, so it cannot be forged.
  // Only the jwt.verify step is allowed to fail silently (expired/invalid/
  // missing access token — api-jwt-auth: "Logout without an active
  // session"). A genuine revocation failure (e.g. a DB error) must NOT be
  // swallowed by that same tolerance, or logout would report success while
  // the family was never actually revoked (found during PR2 apply).
  private tryReadFamilyId(token: string): string | undefined {
    try {
      return (jwt.verify(token, getJwtSecret()) as { familyId?: string }).familyId;
    } catch {
      return undefined;
    }
  }

  logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = req.cookies?.[AUTH_COOKIE];
      const familyId = token ? this.tryReadFamilyId(token) : undefined;
      if (familyId && this.revokeRefreshTokenUseCase) {
        await this.revokeRefreshTokenUseCase.execute(familyId);
      }
      clearSessionCookies(res);
      res.sendStatus(204);
    } catch (error) {
      next(error);
    }
  };

  refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!this.refreshSessionUseCase) {
        throw new Error('RefreshSessionUseCase not injected');
      }

      const presentedPlainToken = req.cookies?.[REFRESH_COOKIE];
      if (!presentedPlainToken) {
        res.status(401).json({ error: 'Sesión expirada' });
        return;
      }

      const newPlainToken = generateRefreshToken();
      const result = await this.refreshSessionUseCase.execute({ presentedPlainToken, newPlainToken });

      if (result.outcome === 'rejected') {
        res.status(401).json({ error: 'Sesión expirada' });
        return;
      }

      const { user, familyId } = result;
      issueAccessCookie(res, { userId: user.idUser, email: user.email, category: user.category, idRole: user.idRole, familyId });

      // Only the rotation winner ever writes the refresh cookie (design.md
      // D2) — a grace hit must not, or it would overwrite the winner's
      // Set-Cookie with the superseded value in the shared cookie jar.
      if (result.outcome === 'rotated') {
        const maxAge = result.refreshToken.expiryDate.getTime() - Date.now();
        issueRefreshCookie(res, newPlainToken, maxAge);
      }

      res.json({
        user: {
          idUser: user.idUser,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          image: user.image,
          idRole: user.idRole,
          category: user.category,
        }
      });
    } catch (error) {
      next(error);
    }
  };

  register = async (
    req: Request & { file?: { key: string; location: string } },
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!this.registerUserUseCase) {
        throw new Error('RegisterUserUseCase not injected');
      }

      if (!req.file) {
        res.status(400).json({ error: 'Tienes que subir una imagen' });
        return;
      }

      const { firstName, lastName, email, password } = req.body;
      const image = req.file.location;

      const userDto = await this.registerUserUseCase.execute({ firstName, lastName, email, password, image });
      await this.establishSession(res, userDto);

      res.status(201).json({
        user: {
          idUser: userDto.idUser,
          firstName: userDto.firstName,
          lastName: userDto.lastName,
          email: userDto.email,
          image: userDto.image,
          idRole: userDto.idRole,
          category: userDto.category,
        }
      });
    } catch (error) {
      if (error instanceof UserAlreadyExistsException) {
        if (req.file?.key) {
          cleanupUploadedFile(req.file.key);
        }
        res.status(400).json({ error: error.message });
        return;
      }
      next(error);
    }
  };

  index = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const users = await this.listUsersUseCase.execute();
      res.json({ count: users.length, users });
    } catch (error) {
      next(error);
    }
  };

  show = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      const user = await this.getUserByIdUseCase.execute(id);
      res.json(user);
    } catch (error) {
      if (error instanceof Error && error.message === 'User not found') {
        res.status(404).json({ error: 'Usuario no encontrado' });
        return;
      }
      next(error);
    }
  };
}
