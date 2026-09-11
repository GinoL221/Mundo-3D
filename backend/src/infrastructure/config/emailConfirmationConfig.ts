import { PublicOriginPort } from '../../domain/ports/PublicOriginPort';

class ValidatedPublicOrigin implements PublicOriginPort {
  constructor(private readonly origin: string) {}

  buildConfirmationUrl(token: string): string {
    const url = new URL('/confirm-email', this.origin);
    url.searchParams.set('token', token);
    return url.toString();
  }
}

function parsePublicOrigin(value: string | undefined): PublicOriginPort {
  if (!value) {
    throw new Error('PUBLIC_APP_URL is required');
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('PUBLIC_APP_URL must be an absolute HTTP(S) origin');
  }

  const isRootPath = url.pathname === '/';
  const isLocalhostDemo = url.hostname === 'localhost' && url.protocol === 'http:';
  const isHttps = url.protocol === 'https:';

  if (
    !isRootPath ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (!isHttps && !isLocalhostDemo)
  ) {
    throw new Error('PUBLIC_APP_URL must be a trusted HTTPS origin or HTTP localhost demo origin');
  }

  return new ValidatedPublicOrigin(url.origin);
}

export function loadEmailConfirmationConfig(environment: NodeJS.ProcessEnv): {
  publicOrigin: PublicOriginPort;
} {
  return { publicOrigin: parsePublicOrigin(environment.PUBLIC_APP_URL) };
}
