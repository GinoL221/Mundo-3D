import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import path from 'path';

function generateToken(req: Request, res: Response): string {
  const token = crypto.randomBytes(32).toString('hex');
  if (req.session) {
    req.session.csrfToken = token;
  }
  res.locals.csrfToken = token;
  return token;
}

export function csrfProtection(req: Request, res: Response, next: NextFunction): any {
  // Skip CSRF for API routes — they should use token-based auth instead
  if (req.path.startsWith('/api/')) {
    return next();
  }

  const method = req.method.toUpperCase();

  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    // Generate token for the next form submission
    generateToken(req, res);
    return next();
  }

  // POST, PUT, DELETE — validate the submitted token
  const submittedToken =
    (req.body && req.body._csrf) || req.headers['x-csrf-token'] || (req.query && req.query._csrf);

  const sessionToken = req.session && req.session.csrfToken;

  if (!submittedToken || !sessionToken || typeof submittedToken !== 'string' || typeof sessionToken !== 'string') {
    return res.status(403).render(path.join(__dirname, '../../views/403Forbidden.ejs'), {
      message: 'Token CSRF inválido. Vuelve atrás e intenta de nuevo.',
    });
  }

  // Constant-time comparison to prevent timing attacks
  try {
    const isValid = crypto.timingSafeEqual(
      Buffer.from(submittedToken, 'hex'),
      Buffer.from(sessionToken, 'hex'),
    );

    if (!isValid) {
      return res.status(403).render(path.join(__dirname, '../../views/403Forbidden.ejs'), {
        message: 'Token CSRF inválido. Vuelve atrás e intenta de nuevo.',
      });
    }
  } catch (err) {
    // Tokens with different lengths will throw — treat as invalid
    return res.status(403).render(path.join(__dirname, '../../views/403Forbidden.ejs'), {
      message: 'Token CSRF inválido. Vuelve atrás e intenta de nuevo.',
    });
  }

  // Token is valid — generate a new one for the next request
  generateToken(req, res);
  next();
}
