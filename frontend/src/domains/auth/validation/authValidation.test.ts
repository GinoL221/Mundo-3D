import { describe, expect, it } from 'vitest';
import {
  evaluatePasswordRules,
  extractApiFieldErrors,
  isAllowedImageFileName,
  summarizeFieldErrors,
  validateLoginInput,
  validateRegisterInput,
} from './authValidation';

describe('evaluatePasswordRules', () => {
  it('marks all rules false for empty password', () => {
    expect(evaluatePasswordRules('', '')).toEqual({
      length: false,
      uppercase: false,
      number: false,
      special: false,
      match: false,
    });
  });

  it('tracks length 8-32, uppercase, number, special char, and match live', () => {
    expect(evaluatePasswordRules('Short1!', 'Short1!')).toEqual({
      length: false,
      uppercase: true,
      number: true,
      special: true,
      match: true,
    });

    expect(evaluatePasswordRules('Password123!', 'Password123!')).toEqual({
      length: true,
      uppercase: true,
      number: true,
      special: true,
      match: true,
    });

    const tooLong = 'A1!' + 'a'.repeat(30);
    expect(evaluatePasswordRules(tooLong, tooLong).length).toBe(false);
  });
});

describe('isAllowedImageFileName', () => {
  it('accepts lowercase .jpg and .png only, like the backend', () => {
    expect(isAllowedImageFileName('avatar.jpg')).toBe(true);
    expect(isAllowedImageFileName('avatar.png')).toBe(true);
    // Backend checks path.extname case-sensitively against .jpg/.png.
    expect(isAllowedImageFileName('PHOTO.JPG')).toBe(false);
    expect(isAllowedImageFileName('photo.PNG')).toBe(false);
    expect(isAllowedImageFileName('photo.jpeg')).toBe(false);
    expect(isAllowedImageFileName('avatar.webp')).toBe(false);
    expect(isAllowedImageFileName('avatar.gif')).toBe(false);
  });
});

describe('validateRegisterInput', () => {
  const validInput = {
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.com',
    password: 'Password123!',
    confirmPassword: 'Password123!',
  };

  it('returns no errors for a valid submission without an image', () => {
    expect(validateRegisterInput(validInput)).toEqual({});
  });

  it('returns no errors when an optional .jpg or .png image is provided', () => {
    expect(validateRegisterInput({ ...validInput, imageName: 'perfil.png' })).toEqual({});
  });

  it('returns exact voseo required messages for empty fields', () => {
    expect(
      validateRegisterInput({
        firstName: '   ',
        lastName: '',
        email: '',
        password: '',
        confirmPassword: '',
      })
    ).toEqual({
      firstName: 'Ingresá tu nombre',
      lastName: 'Ingresá tu apellido',
      email: 'Ingresá tu correo',
      password: 'Ingresá tu contraseña',
      confirmPassword: 'Confirmá tu contraseña',
    });
  });

  it('enforces name length 2-10, email format, password rules, confirm match, and image extension', () => {
    expect(
      validateRegisterInput({
        firstName: 'A',
        lastName: 'ApellidoMuyLargo',
        email: 'no-es-correo',
        password: 'password123!',
        confirmPassword: 'Password123!',
        imageName: 'foto.webp',
      })
    ).toEqual({
      firstName: 'Tiene que tener entre 2 y 10 caracteres',
      lastName: 'Tiene que tener entre 2 y 10 caracteres',
      email: 'Ingresá un correo válido',
      password: 'Tiene que contener al menos una mayúscula',
      confirmPassword: 'Las contraseñas no coinciden',
      image: 'Las extensiones de archivos permitidas son .jpg, .png',
    });
  });

  it('checks password length, number, and special character in backend order', () => {
    expect(validateRegisterInput({ ...validInput, password: 'Ab1!', confirmPassword: 'Ab1!' }).password).toBe(
      'Tiene que tener entre 8 y 32 caracteres'
    );
    expect(
      validateRegisterInput({ ...validInput, password: 'Password!', confirmPassword: 'Password!' }).password
    ).toBe('Tiene que contener al menos un número');
    expect(
      validateRegisterInput({ ...validInput, password: 'Password1', confirmPassword: 'Password1' }).password
    ).toBe('Tiene que contener al menos un carácter especial');
  });
});

describe('validateLoginInput', () => {
  it('returns per-field errors and the shared empty-fields summary when empty', () => {
    expect(validateLoginInput({ email: '', password: '' })).toEqual({
      summary: 'Por favor completá todos los campos.',
      fieldErrors: {
        email: 'Ingresá tu correo',
        password: 'Ingresá tu contraseña',
      },
    });
  });

  it('returns no errors when both fields are populated', () => {
    expect(validateLoginInput({ email: 'ada@example.com', password: 'secret' })).toEqual({
      summary: null,
      fieldErrors: {},
    });
  });
});

describe('extractApiFieldErrors & summarizeFieldErrors', () => {
  it('extracts fieldErrors from ApiError-like objects and ignores non-object errors', () => {
    const err = Object.assign(new Error('Ingresá tu nombre'), {
      fieldErrors: { firstName: 'Ingresá tu nombre', email: 'Ingresá un correo válido' },
    });
    expect(extractApiFieldErrors(err)).toEqual({
      firstName: 'Ingresá tu nombre',
      email: 'Ingresá un correo válido',
    });
    expect(extractApiFieldErrors(new Error('plain'))).toEqual({});
    expect(extractApiFieldErrors(null)).toEqual({});
  });

  it('returns the single message for 1 error and the summary for multiple errors', () => {
    expect(summarizeFieldErrors({ email: 'Ingresá un correo válido' }, 'Revisá los campos.')).toBe(
      'Ingresá un correo válido'
    );
    expect(
      summarizeFieldErrors(
        { firstName: 'Ingresá tu nombre', email: 'Ingresá un correo válido' },
        'Revisá los campos marcados antes de crear tu cuenta.'
      )
    ).toBe('Revisá los campos marcados antes de crear tu cuenta.');
  });
});
