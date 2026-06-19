import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthenticateUserUseCase } from '../../application/use-cases/AuthenticateUserUseCase';
import { ListUsersUseCase } from '../../application/use-cases/ListUsersUseCase';
import { GetUserByIdUseCase } from '../../application/use-cases/GetUserByIdUseCase';
import { InvalidCredentialsException } from '../../domain/exceptions/InvalidCredentialsException';

export class UserApiController {
  constructor(
    private readonly authenticateUserUseCase: AuthenticateUserUseCase,
    private readonly listUsersUseCase: ListUsersUseCase,
    private readonly getUserByIdUseCase: GetUserByIdUseCase
  ) {}

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const email = req.body.Email || req.body.email;
      const password = req.body.Password || req.body.password;

      const userDto = await this.authenticateUserUseCase.execute({
        email: email,
        password: password,
      });

      const payload = {
        userId: userDto.idUser,
        email: userDto.email,
        category: userDto.category,
        idRole: userDto.idRole,
      };

      const secret = process.env.JWT_SECRET || 'test_jwt_secret';
      const token = jwt.sign(payload, secret, { expiresIn: '2h' });

      res.json({ token });
    } catch (error: any) {
      if (error instanceof InvalidCredentialsException) {
        res.status(401).json({ error: 'El email o la contraseña no coinciden' });
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
    } catch (error: any) {
      if (error.message === 'User not found') {
        res.status(404).json({ error: 'Usuario no encontrado' });
        return;
      }
      next(error);
    }
  };
}
