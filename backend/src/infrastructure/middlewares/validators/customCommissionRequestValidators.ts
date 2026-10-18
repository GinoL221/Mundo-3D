import { body } from 'express-validator';

export const CUSTOM_REQUEST_MAX_NAME_LENGTH = 100;
export const CUSTOM_REQUEST_MAX_EMAIL_LENGTH = 254;
export const CUSTOM_REQUEST_MAX_IDEA_LENGTH = 5000;

export const customCommissionRequestValidators = [
  body().custom((_value, { req }) => {
    const allowed = new Set(['name', 'email', 'idea', 'idProduct']);
    if (Object.keys(req.body ?? {}).some((key) => !allowed.has(key))) {
      throw new Error('Unexpected request field');
    }
    return true;
  }),
  body('name').exists().withMessage('Name is required').bail().isString().withMessage('Name must be text').bail()
    .trim().notEmpty().withMessage('Name is required').bail().isLength({ max: CUSTOM_REQUEST_MAX_NAME_LENGTH }).withMessage('Name is too long'),
  body('email').exists().withMessage('Email is required').bail().isString().withMessage('Email must be text').bail()
    .trim().notEmpty().withMessage('Email is required').bail().isLength({ max: CUSTOM_REQUEST_MAX_EMAIL_LENGTH }).withMessage('Email is too long').bail().isEmail().withMessage('Email is invalid'),
  body('idea').exists().withMessage('Idea is required').bail().isString().withMessage('Idea must be text').bail()
    .trim().notEmpty().withMessage('Idea is required').bail().isLength({ max: CUSTOM_REQUEST_MAX_IDEA_LENGTH }).withMessage('Idea is too long'),
  body('idProduct').optional({ values: 'null' }).custom((value) => typeof value === 'number' && Number.isSafeInteger(value) && value > 0).withMessage('Product id must be a positive integer'),
];
