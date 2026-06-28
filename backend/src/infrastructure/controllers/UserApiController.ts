import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthenticateUserUseCase } from '../../application/use-cases/AuthenticateUserUseCase';
import { ListUsersUseCase } from '../../application/use-cases/ListUsersUseCase';
import { GetUserByIdUseCase } from '../../application/use-cases/GetUserByIdUseCase';
import { RegisterUserUseCase } from '../../application/use-cases/RegisterUserUseCase';
import { InvalidCredentialsException } from '../../domain/exceptions/InvalidCredentialsException';
import { UserAlreadyExistsException } from '../../domain/exceptions/UserAlreadyExistsException';
import { validationResult } from 'express-validator';
import { getJwtSecret } from '../security/JwtSecret';

export class UserApiController {
  constructor(
    private readonly authenticateUserUseCase: AuthenticateUserUseCase,
    private readonly listUsersUseCase: ListUsersUseCase,
    private readonly getUserByIdUseCase: GetUserByIdUseCase,
    private readonly registerUserUseCase?: RegisterUserUseCase
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

      const token = jwt.sign(payload, getJwtSecret(), { expiresIn: '2h' });

      res.json({
        token,
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

  register = async (req: Request & { file?: { filename: string } }, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!this.registerUserUseCase) {
        throw new Error('RegisterUserUseCase not injected');
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.mapped() });
        return;
      }

      if (!req.file) {
        res.status(400).json({ error: 'Tienes que subir una imagen' });
        return;
      }

      const { firstName, lastName, email, password } = req.body;
      const image = req.file.filename;

      const userDto = await this.registerUserUseCase.execute({
        firstName,
        lastName,
        email,
        password,
        image,
      });

      const payload = {
        userId: userDto.idUser,
        email: userDto.email,
        category: userDto.category,
        idRole: userDto.idRole,
      };

      const token = jwt.sign(payload, getJwtSecret(), { expiresIn: '2h' });

      res.status(201).json({
        token,
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
