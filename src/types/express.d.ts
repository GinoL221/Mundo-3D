import { UserDTO } from '../application/dtos/UserDTO';

declare global {
  namespace Express {
    interface Request {
      user?: {
        userID: number;
        Email: string;
        Category: string | null;
        IDRole: number;
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



