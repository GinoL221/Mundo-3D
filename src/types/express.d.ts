import { UserDTO } from '../application/dtos/UserDTO';

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: number;
        email: string;
        category: string | null;
        idRole: number;
      };
      session?: {
        userLogged?: Partial<UserDTO>;
        [key: string]: any;
      };
      file?: any;
      files?: any;
    }
  }
}



