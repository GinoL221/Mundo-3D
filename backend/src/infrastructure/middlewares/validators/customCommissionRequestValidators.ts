import { body } from 'express-validator';

const requiredText = (field: string, label: string, maxLength: number) =>
  body(field)
    .exists().withMessage(`${label} is required`)
    .bail().isString().withMessage(`${label} must be text`)
    .bail().trim().notEmpty().withMessage(`${label} is required`)
    .bail().isLength({ max: maxLength }).withMessage(`${label} is too long`);

export const customCommissionRequestValidators = [
  body().custom((_value, { req }) =>
    Object.keys(req.body ?? {}).every((key) => ['name', 'email', 'idea', 'idProduct'].includes(key)),
  ).withMessage('Unexpected request field'),
  requiredText('name', 'Name', 100),
  requiredText('email', 'Email', 254).bail().isEmail().withMessage('Email is invalid'),
  requiredText('idea', 'Idea', 5000),
  body('idProduct')
    .optional({ values: 'null' })
    .custom((value) => typeof value === 'number' && Number.isSafeInteger(value) && value > 0)
    .withMessage('Product id must be a positive integer'),
];
