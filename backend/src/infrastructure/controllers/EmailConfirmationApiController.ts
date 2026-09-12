import { NextFunction, Request, Response } from 'express';
import { ConfirmEmailUseCase } from '../../application/use-cases/ConfirmEmailUseCase';
import { ResendEmailConfirmationUseCase } from '../../application/use-cases/ResendEmailConfirmationUseCase';
import { InvalidEmailConfirmationToken } from '../../domain/exceptions/InvalidEmailConfirmationToken';

const invalidResponse = (res: Response): void => {
  res.status(400).json({ error: 'Invalid email confirmation token' });
};

const resendAcceptedResponse = (res: Response): void => {
  res.status(202).json({
    message: 'If the account is eligible, a confirmation email will be sent.',
  });
};

const isBoundedToken = (token: unknown): token is string =>
  typeof token === 'string' && token.length >= 16 && token.length <= 512;

export class EmailConfirmationApiController {
  constructor(
    private readonly confirmEmailUseCase: Pick<ConfirmEmailUseCase, 'execute'>,
    private readonly resendEmailConfirmationUseCase?: Pick<
      ResendEmailConfirmationUseCase,
      'execute'
    >,
  ) {}

  confirm = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const token = req.body?.token;
    if (!isBoundedToken(token)) {
      invalidResponse(res);
      return;
    }

    try {
      await this.confirmEmailUseCase.execute({ token });
      res.sendStatus(204);
    } catch (error) {
      if (error instanceof InvalidEmailConfirmationToken) {
        invalidResponse(res);
        return;
      }
      next(error);
    }
  };

  resend = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (this.resendEmailConfirmationUseCase) {
        await this.resendEmailConfirmationUseCase.execute({ email: req.body.email });
      }
      resendAcceptedResponse(res);
    } catch (error) {
      next(error);
    }
  };
}
