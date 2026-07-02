import { Request } from 'express';
import { validationResult } from 'express-validator';
import { productCreateValidators, productUpdateValidators } from '../validators/productValidators';
import { validationsUsers, loginValidation } from '../validators/userValidators';

async function runValidation(req: Request, validations: any[]) {
  // Clear validation metadata before each run
  (req as any)._validationErrors = undefined;
  for (const validation of validations) {
    await validation.run(req);
  }
  return validationResult(req);
}

describe('productValidators - productCreateValidators', () => {
  let req: any;

  beforeEach(() => {
    req = {
      body: {},
      file: undefined
    };
  });

  it('fails if required fields are missing or empty', async () => {
    const errors = await runValidation(req as Request, productCreateValidators);
    expect(errors.isEmpty()).toBe(false);
    expect(errors.mapped().nameProduct).toBeDefined();
    expect(errors.mapped().price).toBeDefined();
    expect(errors.mapped().descriptionProduct).toBeDefined();
    expect(errors.mapped().idCategory).toBeDefined();
    expect(errors.mapped().idFranchise).toBeDefined();
    expect(errors.mapped().image).toBeDefined();
  });

  it('fails if nameProduct is too short', async () => {
    req.body = {
      nameProduct: 'abc', // less than 5
      price: '100',
      descriptionProduct: 'valid description here',
      idCategory: '1',
      idFranchise: '2'
    };
    req.file = { originalname: 'test.jpg' } as any;

    const errors = await runValidation(req as Request, productCreateValidators);
    expect(errors.mapped().nameProduct).toBeDefined();
    expect(errors.mapped().nameProduct.msg).toBe('Tiene que tener entre 5 y 20 caracteres');
  });

  it('fails if price is not numeric', async () => {
    req.body = {
      nameProduct: 'valid name',
      price: 'not-a-number',
      descriptionProduct: 'valid description here',
      idCategory: '1',
      idFranchise: '2'
    };
    req.file = { originalname: 'test.jpg' } as any;

    const errors = await runValidation(req as Request, productCreateValidators);
    expect(errors.mapped().price).toBeDefined();
    expect(errors.mapped().price.msg).toBe('Debe ingresar un número');
  });

  it('fails if image is missing (required on create)', async () => {
    req.body = {
      nameProduct: 'valid name',
      price: '123.45',
      descriptionProduct: 'valid description here',
      idCategory: '1',
      idFranchise: '2'
    };
    req.file = undefined;

    const errors = await runValidation(req as Request, productCreateValidators);
    expect(errors.mapped().image).toBeDefined();
    expect(errors.mapped().image.msg).toBe('Tienes que subir una imagen');
  });

  it('fails if image extension is not allowed', async () => {
    req.body = {
      nameProduct: 'valid name',
      price: '123.45',
      descriptionProduct: 'valid description here',
      idCategory: '1',
      idFranchise: '2'
    };
    req.file = { originalname: 'test.gif' } as any;

    const errors = await runValidation(req as Request, productCreateValidators);
    expect(errors.mapped().image).toBeDefined();
    expect(errors.mapped().image.msg).toContain('Las extensiones de archivos permitidas son .jpg, .png');
  });

  it('fails when stock is negative', async () => {
    req.body = {
      nameProduct: 'Super Mario 3D',
      price: '1250',
      descriptionProduct: 'An awesome action figure',
      idCategory: '1',
      idFranchise: '2',
      stock: '-1'
    };
    req.file = { originalname: 'mario.png' } as any;

    const errors = await runValidation(req as Request, productCreateValidators);
    expect(errors.mapped().stock).toBeDefined();
  });

  it('passes when stock is omitted (optional, defaults handled by the use case)', async () => {
    req.body = {
      nameProduct: 'Super Mario 3D',
      price: '1250',
      descriptionProduct: 'An awesome action figure',
      idCategory: '1',
      idFranchise: '2'
    };
    req.file = { originalname: 'mario.png' } as any;

    const errors = await runValidation(req as Request, productCreateValidators);
    expect(errors.mapped().stock).toBeUndefined();
  });

  it('passes on valid product inputs', async () => {
    req.body = {
      nameProduct: 'Super Mario 3D',
      price: '1250',
      descriptionProduct: 'An awesome action figure',
      idCategory: '1',
      idFranchise: '2',
      stock: '5'
    };
    req.file = { originalname: 'mario.png' } as any;

    const errors = await runValidation(req as Request, productCreateValidators);
    expect(errors.isEmpty()).toBe(true);
  });

  describe('3D printing attributes', () => {
    const baseValidBody = {
      nameProduct: 'Super Mario 3D',
      price: '1250',
      descriptionProduct: 'An awesome action figure',
      idCategory: '1',
      idFranchise: '2'
    };
    const validFile = { originalname: 'mario.png' } as any;

    it('passes when material is a valid allowed value', async () => {
      req.body = { ...baseValidBody, material: 'PLA' };
      req.file = validFile;

      const errors = await runValidation(req as Request, productCreateValidators);
      expect(errors.mapped().material).toBeUndefined();
    });

    it('passes when material uses the "Otros: " custom prefix', async () => {
      req.body = { ...baseValidBody, material: 'Otros: Madera' };
      req.file = validFile;

      const errors = await runValidation(req as Request, productCreateValidators);
      expect(errors.mapped().material).toBeUndefined();
    });

    it('fails when material is not an allowed value or custom prefix', async () => {
      req.body = { ...baseValidBody, material: 'Madera' };
      req.file = validFile;

      const errors = await runValidation(req as Request, productCreateValidators);
      expect(errors.mapped().material).toBeDefined();
    });

    it('passes when productionTime is within range (1-30)', async () => {
      req.body = { ...baseValidBody, productionTime: '15' };
      req.file = validFile;

      const errors = await runValidation(req as Request, productCreateValidators);
      expect(errors.mapped().productionTime).toBeUndefined();
    });

    it('fails when productionTime exceeds 30', async () => {
      req.body = { ...baseValidBody, productionTime: '31' };
      req.file = validFile;

      const errors = await runValidation(req as Request, productCreateValidators);
      expect(errors.mapped().productionTime).toBeDefined();
    });

    it('fails when height, width or depth are negative', async () => {
      req.body = { ...baseValidBody, height: '-1', width: '-2', depth: '-3' };
      req.file = validFile;

      const errors = await runValidation(req as Request, productCreateValidators);
      expect(errors.mapped().height).toBeDefined();
      expect(errors.mapped().width).toBeDefined();
      expect(errors.mapped().depth).toBeDefined();
    });

    it('passes when height, width and depth are non-negative numbers', async () => {
      req.body = { ...baseValidBody, height: '10.5', width: '8', depth: '5.5' };
      req.file = validFile;

      const errors = await runValidation(req as Request, productCreateValidators);
      expect(errors.mapped().height).toBeUndefined();
      expect(errors.mapped().width).toBeUndefined();
      expect(errors.mapped().depth).toBeUndefined();
    });

    it('passes when the 3D attributes are omitted entirely (all optional)', async () => {
      req.body = { ...baseValidBody };
      req.file = validFile;

      const errors = await runValidation(req as Request, productCreateValidators);
      expect(errors.isEmpty()).toBe(true);
    });
  });
});

describe('productValidators - productUpdateValidators', () => {
  let req: any;

  beforeEach(() => {
    req = {
      body: {},
      file: undefined
    };
  });

  it('passes with an empty body and no image (all fields optional on update)', async () => {
    const errors = await runValidation(req as Request, productUpdateValidators);
    expect(errors.isEmpty()).toBe(true);
  });

  it('passes when only some fields are provided', async () => {
    req.body = { nameProduct: 'Updated Name Here', price: '999' };

    const errors = await runValidation(req as Request, productUpdateValidators);
    expect(errors.isEmpty()).toBe(true);
  });

  it('fails if a provided field is invalid (nameProduct too short)', async () => {
    req.body = { nameProduct: 'abc' };

    const errors = await runValidation(req as Request, productUpdateValidators);
    expect(errors.mapped().nameProduct).toBeDefined();
  });

  it('fails if image extension is not allowed when an image is provided', async () => {
    req.file = { originalname: 'test.gif' } as any;

    const errors = await runValidation(req as Request, productUpdateValidators);
    expect(errors.mapped().image).toBeDefined();
  });

  it('passes when no image is provided (image optional on update)', async () => {
    req.body = { nameProduct: 'Valid Name Here' };
    req.file = undefined;

    const errors = await runValidation(req as Request, productUpdateValidators);
    expect(errors.mapped().image).toBeUndefined();
  });

  it('fails when stock is provided and negative', async () => {
    req.body = { stock: '-3' };

    const errors = await runValidation(req as Request, productUpdateValidators);
    expect(errors.mapped().stock).toBeDefined();
  });
});

describe('userValidators - validationsUsers', () => {
  let req: any;

  beforeEach(() => {
    req = {
      body: {},
      file: undefined
    };
  });

  it('fails if firstName or lastName are invalid', async () => {
    req.body = {
      firstName: 'A', // too short (less than 2)
      lastName: 'AVeryLongLastNameThatExceedsLimit', // too long (more than 10)
      email: 'not-an-email',
      password: '123', // too short
      confirmPassword: '123'
    };
    req.file = { originalname: 'user.jpg' } as any;

    const errors = await runValidation(req as Request, validationsUsers);
    expect(errors.mapped().firstName).toBeDefined();
    expect(errors.mapped().lastName).toBeDefined();
    expect(errors.mapped().email).toBeDefined();
    expect(errors.mapped().password).toBeDefined();
  });

  it('passes on valid user inputs', async () => {
    req.body = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@doe.com',
      password: 'Password123!',
      confirmPassword: 'Password123!'
    };
    req.file = { originalname: 'photo.png' } as any;

    const errors = await runValidation(req as Request, validationsUsers);
    expect(errors.isEmpty()).toBe(true);
  });

  it('fails if no image is uploaded', async () => {
    req.body = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@doe.com',
      password: 'Password123!',
      confirmPassword: 'Password123!'
    };
    req.file = undefined;

    const errors = await runValidation(req as Request, validationsUsers);
    expect(errors.mapped().image).toBeDefined();
    expect(errors.mapped().image.msg).toBe('Tienes que subir una imagen');
  });

  it('fails if image extension is not allowed', async () => {
    req.body = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@doe.com',
      password: 'Password123!',
      confirmPassword: 'Password123!'
    };
    req.file = { originalname: 'photo.gif' } as any;

    const errors = await runValidation(req as Request, validationsUsers);
    expect(errors.mapped().image).toBeDefined();
    expect(errors.mapped().image.msg).toBe('Las extensiones de archivos permitidas son .jpg, .png');
  });

  it('fails if confirmPassword is missing or empty', async () => {
    req.body = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@doe.com',
      password: 'Password123!',
      confirmPassword: ''
    };
    req.file = { originalname: 'photo.png' } as any;

    const errors = await runValidation(req as Request, validationsUsers);
    expect(errors.mapped().confirmPassword).toBeDefined();
    expect(errors.mapped().confirmPassword.msg).toBe('Tienes que confirmar la contraseña');
  });

  it('fails if confirmPassword does not match password', async () => {
    req.body = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@doe.com',
      password: 'Password123!',
      confirmPassword: 'DifferentPassword123!'
    };
    req.file = { originalname: 'photo.png' } as any;

    const errors = await runValidation(req as Request, validationsUsers);
    expect(errors.mapped().confirmPassword).toBeDefined();
    expect(errors.mapped().confirmPassword.msg).toBe('Las contraseñas no coinciden');
  });
});

describe('userValidators - loginValidation', () => {
  let req: any;

  beforeEach(() => {
    req = {
      body: {}
    };
  });

  it('fails on invalid login credentials', async () => {
    req.body = {
      email: 'invalid-email',
      password: '123' // too short
    };

    const errors = await runValidation(req as Request, loginValidation);
    expect(errors.mapped().email).toBeDefined();
    expect(errors.mapped().password).toBeDefined();
  });

  it('passes on valid login credentials structure', async () => {
    req.body = {
      email: 'admin@mundo3d.com',
      password: 'securePassword123'
    };

    const errors = await runValidation(req as Request, loginValidation);
    expect(errors.isEmpty()).toBe(true);
  });
});
