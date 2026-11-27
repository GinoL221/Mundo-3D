import { body } from 'express-validator';

const requiredText = (field: string, label: string, maxLength: number) =>
  body(field)
    .exists().withMessage(`${label} is required`)
    .bail().isString().withMessage(`${label} must be text`)
    .bail().trim().notEmpty().withMessage(`${label} is required`)
    .bail().isLength({ max: maxLength }).withMessage(`${label} is too long`);

const PHONE_ALLOWED_CHARS = /^[+\d\s()-]+$/;

export const customCommissionRequestValidators = [
  body().custom((_value, { req }) =>
    Object.keys(req.body ?? {}).every((key) =>
      ['name', 'email', 'phone', 'idea', 'idProduct'].includes(key),
    ),
  ).withMessage('Unexpected request field'),
  requiredText('name', 'Name', 100),
  requiredText('email', 'Email', 254).bail().isEmail().withMessage('Email is invalid'),
  body('phone')
    .optional({ values: 'null' })
    .isString().withMessage('Phone must be text')
    .bail()
    .trim()
    .custom((value: string) => {
      if (value === '') return true;
      if (value.length > 30 || !PHONE_ALLOWED_CHARS.test(value)) return false;
      const digits = value.replace(/\D/g, '').length;
      return digits >= 7 && digits <= 20;
    })
    .withMessage('Phone number is invalid')
    .customSanitizer((value: unknown) => {
      if (typeof value !== 'string') return null;
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    }),
  requiredText('idea', 'Idea', 5000),
  body('idProduct')
    .optional({ values: 'null' })
    .custom((value) => typeof value === 'number' && Number.isSafeInteger(value) && value > 0)
    .withMessage('Product id must be a positive integer'),
];
