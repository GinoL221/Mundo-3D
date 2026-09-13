import { PublicOriginPort } from '../../domain/ports/PublicOriginPort';

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string | undefined;
  password: string | undefined;
  from: string;
}

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

function parseSmtpConfig(environment: NodeJS.ProcessEnv): SmtpConfig {
  const {
    SMTP_HOST: host,
    SMTP_PORT: portValue,
    SMTP_SECURE: secureValue,
    SMTP_FROM: from,
  } = environment;
  const port = Number(portValue);

  if (!host?.trim() || !from?.trim()) {
    throw new Error('SMTP_HOST and SMTP_FROM are required');
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('SMTP_PORT must be an integer between 1 and 65535');
  }
  if (secureValue !== 'true' && secureValue !== 'false') {
    throw new Error('SMTP_SECURE must be true or false');
  }

  return {
    host,
    port,
    secure: secureValue === 'true',
    user: environment.SMTP_USER || undefined,
    password: environment.SMTP_PASS || undefined,
    from,
  };
}

export function loadEmailConfirmationConfig(environment: NodeJS.ProcessEnv): {
  publicOrigin: PublicOriginPort;
  smtp: SmtpConfig | undefined;
} {
  const hasSmtpConfiguration = [
    environment.SMTP_HOST,
    environment.SMTP_PORT,
    environment.SMTP_SECURE,
    environment.SMTP_USER,
    environment.SMTP_PASS,
    environment.SMTP_FROM,
  ].some((value) => value !== undefined);

  return {
    publicOrigin: parsePublicOrigin(environment.PUBLIC_APP_URL),
    smtp: hasSmtpConfiguration ? parseSmtpConfig(environment) : undefined,
  };
}
