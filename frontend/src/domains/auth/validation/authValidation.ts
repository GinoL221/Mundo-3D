export type RegisterFieldName =
  | 'firstName'
  | 'lastName'
  | 'email'
  | 'password'
  | 'confirmPassword'
  | 'image';

export type LoginFieldName = 'email' | 'password';

export interface PasswordRuleStatus {
  length: boolean;
  uppercase: boolean;
  number: boolean;
  special: boolean;
  match: boolean;
}

export interface RegisterValidationInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  imageName?: string | null;
  imageSize?: number | null;
}

export interface LoginValidationInput {
  email: string;
  password: string;
}

const NAME_MIN_LENGTH = 2;
const NAME_MAX_LENGTH = 10;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 32;
const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.png'] as const;
// Matches the multer `limits.fileSize` in backend/src/infrastructure/middlewares/upload.ts.
const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const IMAGE_EXTENSION_MESSAGE = `Las extensiones de archivos permitidas son ${ALLOWED_IMAGE_EXTENSIONS.join(', ')}`;
const IMAGE_TOO_LARGE_MESSAGE = 'La imagen pesa más de 5 MB. Elegí una más liviana.';
// The backend upload filter answers `{ error }` (no field path) for format or size rejections.
const BACKEND_UPLOAD_REJECTION = 'Invalid file format or size limit exceeded';
const UPLOAD_REJECTION_MESSAGE = 'No pudimos aceptar la imagen: tiene que ser JPG o PNG y pesar hasta 5 MB.';

const SIMPLE_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function evaluatePasswordRules(password: string, confirmPassword: string): PasswordRuleStatus {
  const trimmedPassword = password.trim();
  const trimmedConfirm = confirmPassword.trim();
  return {
    length:
      trimmedPassword.length >= PASSWORD_MIN_LENGTH &&
      trimmedPassword.length <= PASSWORD_MAX_LENGTH,
    uppercase: /[A-Z]/.test(trimmedPassword),
    number: /[0-9]/.test(trimmedPassword),
    special: /[^A-Za-z0-9]/.test(trimmedPassword),
    match: trimmedPassword.length > 0 && trimmedPassword === trimmedConfirm,
  };
}

export function isAllowedImageFileName(fileName: string): boolean {
  // Mirrors the backend's case-sensitive `path.extname` check: no trimming, and a
  // leading dot alone (".jpg") is not an extension.
  const lastDot = fileName.lastIndexOf('.');
  if (lastDot <= 0) return false;
  return (ALLOWED_IMAGE_EXTENSIONS as readonly string[]).includes(fileName.slice(lastDot));
}

export function validateImageFile(fileName: string, sizeInBytes: number | null | undefined): string | null {
  if (!isAllowedImageFileName(fileName)) return IMAGE_EXTENSION_MESSAGE;
  if (typeof sizeInBytes === 'number' && sizeInBytes > IMAGE_MAX_BYTES) return IMAGE_TOO_LARGE_MESSAGE;
  return null;
}

export function uploadRejectionMessage(err: unknown): string | null {
  return err instanceof Error && err.message === BACKEND_UPLOAD_REJECTION ? UPLOAD_REJECTION_MESSAGE : null;
}

export function validateRegisterInput(
  input: RegisterValidationInput
): Partial<Record<RegisterFieldName, string>> {
  const errors: Partial<Record<RegisterFieldName, string>> = {};

  const firstName = input.firstName.trim();
  if (!firstName) {
    errors.firstName = 'Ingresá tu nombre';
  } else if (firstName.length < NAME_MIN_LENGTH || firstName.length > NAME_MAX_LENGTH) {
    errors.firstName = 'Tiene que tener entre 2 y 10 caracteres';
  }

  const lastName = input.lastName.trim();
  if (!lastName) {
    errors.lastName = 'Ingresá tu apellido';
  } else if (lastName.length < NAME_MIN_LENGTH || lastName.length > NAME_MAX_LENGTH) {
    errors.lastName = 'Tiene que tener entre 2 y 10 caracteres';
  }

  const email = input.email.trim();
  if (!email) {
    errors.email = 'Ingresá tu correo';
  } else if (!SIMPLE_EMAIL_PATTERN.test(email)) {
    errors.email = 'Ingresá un correo válido';
  }

  const password = input.password.trim();
  const rules = evaluatePasswordRules(input.password, input.confirmPassword);
  if (!password) {
    errors.password = 'Ingresá tu contraseña';
  } else if (!rules.length) {
    errors.password = 'Tiene que tener entre 8 y 32 caracteres';
  } else if (!rules.uppercase) {
    errors.password = 'Tiene que contener al menos una mayúscula';
  } else if (!rules.number) {
    errors.password = 'Tiene que contener al menos un número';
  } else if (!rules.special) {
    errors.password = 'Tiene que contener al menos un carácter especial';
  }

  const confirmPassword = input.confirmPassword.trim();
  if (!confirmPassword) {
    errors.confirmPassword = 'Confirmá tu contraseña';
  } else if (confirmPassword !== password) {
    errors.confirmPassword = 'Las contraseñas no coinciden';
  }

  const imageName = input.imageName ?? '';
  if (imageName.trim()) {
    const imageError = validateImageFile(imageName, input.imageSize);
    if (imageError) errors.image = imageError;
  }

  return errors;
}

export function validateLoginInput(input: LoginValidationInput): {
  summary: string | null;
  fieldErrors: Partial<Record<LoginFieldName, string>>;
} {
  const fieldErrors: Partial<Record<LoginFieldName, string>> = {};
  const email = input.email.trim();
  const password = input.password;

  if (!email) {
    fieldErrors.email = 'Ingresá tu correo';
  }
  if (!password) {
    fieldErrors.password = 'Ingresá tu contraseña';
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      summary: 'Por favor completá todos los campos.',
      fieldErrors,
    };
  }

  return { summary: null, fieldErrors };
}

export function extractApiFieldErrors(err: unknown): Record<string, string> {
  if (typeof err !== 'object' || err === null || !('fieldErrors' in err)) {
    return {};
  }
  const candidate = (err as { fieldErrors?: unknown }).fieldErrors;
  if (typeof candidate !== 'object' || candidate === null || Array.isArray(candidate)) {
    return {};
  }
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(candidate)) {
    if (typeof value === 'string' && value.trim()) {
      result[key] = value.trim();
    }
  }
  return result;
}

export function summarizeFieldErrors(
  fieldErrors: Record<string, string>,
  multiErrorSummary: string
): string {
  const messages = Object.values(fieldErrors).filter((msg) => msg.trim().length > 0);
  if (messages.length === 1) {
    return messages[0];
  }
  return multiErrorSummary;
}
