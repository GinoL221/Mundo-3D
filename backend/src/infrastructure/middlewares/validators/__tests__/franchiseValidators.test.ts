import { Request } from 'express';
import { validationResult, ValidationChain } from 'express-validator';
import { franchiseCreateValidators, franchiseUpdateValidators } from '../franchiseValidators';

const validate = async (validators: ValidationChain[], body: Record<string, unknown>) => {
  const req = { body } as Request;
  for (const validator of validators) {
    await validator.run(req);
  }
  return validationResult(req);
};

describe('franchise validators', () => {
  it.each([[franchiseCreateValidators], [franchiseUpdateValidators]])(
    'accepts a non-empty nameFranchise',
    async (validators) => {
      const errors = await validate(validators, { nameFranchise: 'Studio Ghibli' });

      expect(errors.array()).toEqual([]);
    },
  );

  it.each([[franchiseCreateValidators], [franchiseUpdateValidators]])(
    'rejects missing and whitespace-only nameFranchise values',
    async (validators) => {
      const missingErrors = await validate(validators, {});
      const whitespaceErrors = await validate(validators, { nameFranchise: '   ' });

      expect(missingErrors.array()).toHaveLength(1);
      expect(whitespaceErrors.array()).toHaveLength(1);
    },
  );

  it.each([[franchiseCreateValidators], [franchiseUpdateValidators]])(
    'rejects non-string nameFranchise values without coercion',
    async (validators) => {
      const errors = await validate(validators, { nameFranchise: 42 });

      expect(errors.array()).toHaveLength(1);
    },
  );
});
