import 'express';

declare global {
  namespace Express {
    interface Request {
      reqId?: string;
      user?: {
        userId: number;
        email?: string;
        category?: string;
        idRole?: number;
      };
      session?: {
        userLogged?: {
          idUser: number;
          email: string;
          firstName: string;
          lastName: string;
          image: string | null;
          idRole: number;
          category: string;
        };
        csrfToken?: string;
      };
      file?: {
        fieldname?: string;
        originalname?: string;
        encoding?: string;
        mimetype?: string;
        size?: number;
        destination?: string;
        filename: string;
        path?: string;
        buffer?: Buffer;
      };
    }
  }
}
