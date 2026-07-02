import { Product } from '../../domain/entities/Product';
import { Category } from '../../domain/entities/Category';
import { Franchise } from '../../domain/entities/Franchise';
import { User } from '../../domain/entities/User';
import { RememberToken } from '../../domain/entities/RememberToken';

describe('Domain Entities', () => {
  it('should create a Category entity correctly', () => {
    const category = new Category(1, 'Figures');
    expect(category.idCategory).toBe(1);
    expect(category.nameCategory).toBe('Figures');
  });

  it('should create a Franchise entity correctly', () => {
    const franchise = new Franchise(2, 'Star Wars');
    expect(franchise.idFranchise).toBe(2);
    expect(franchise.nameFranchise).toBe('Star Wars');
  });

  it('should create a Product entity correctly', () => {
    const category = new Category(1, 'Figures');
    const franchise = new Franchise(2, 'Star Wars');
    const product = new Product(
      10,
      'Action Figure',
      29.99,
      'Detailed figure',
      'figure.jpg',
      1,
      2,
      category,
      franchise
    );

    expect(product.idProduct).toBe(10);
    expect(product.nameProduct).toBe('Action Figure');
    expect(product.price).toBe(29.99);
    expect(product.descriptionProduct).toBe('Detailed figure');
    expect(product.image).toBe('figure.jpg');
    expect(product.idCategory).toBe(1);
    expect(product.idFranchise).toBe(2);
    expect(product.Category).toBe(category);
    expect(product.Franchise).toBe(franchise);

    // Legacy getters
    expect(product.IDProduct).toBe(10);
    expect(product.NameProduct).toBe('Action Figure');
    expect(product.Price).toBe(29.99);
    expect(product.DescriptionProduct).toBe('Detailed figure');
    expect(product.Image).toBe('figure.jpg');
    expect(product.IDCategory).toBe(1);
    expect(product.IDFranchise).toBe(2);
  });

  it('should create a User entity correctly with camelCase properties', () => {
    const user = new User(1, 'John', 'Doe', 'john@example.com', 'hashedpassword', 'john.jpg', 2, 'Admin');
    expect(user.idUser).toBe(1);
    expect(user.firstName).toBe('John');
    expect(user.lastName).toBe('Doe');
    expect(user.email).toBe('john@example.com');
    expect(user.password).toBe('hashedpassword');
    expect(user.image).toBe('john.jpg');
    expect(user.idRole).toBe(2);
    expect(user.category).toBe('Admin');
  });

  it('should create a RememberToken entity correctly with camelCase properties', () => {
    const date = new Date();
    const createdDate = new Date();
    const token = new RememberToken(101, 'hash123', 1, date, createdDate);
    expect(token.idRememberToken).toBe(101);
    expect(token.tokenHash).toBe('hash123');
    expect(token.idUser).toBe(1);
    expect(token.expiryDate).toBe(date);
    expect(token.createdAt).toBe(createdDate);
  });

  it('should throw an error when price is less than or equal to 0.00', () => {
    expect(() => {
      new Product(10, 'Action Figure', 0.00, 'Detailed figure', 'figure.jpg', 1, 2);
    }).toThrow('Price must be greater than 0.00');

    expect(() => {
      new Product(10, 'Action Figure', -5.00, 'Detailed figure', 'figure.jpg', 1, 2);
    }).toThrow('Price must be greater than 0.00');
  });

  it('should create a Product with 3D attributes correctly', () => {
    const product = new Product(
      10,
      'Action Figure',
      29.99,
      'Detailed figure',
      'figure.jpg',
      1,
      2,
      undefined,
      undefined,
      'PLA',
      10.5,
      8.0,
      5.5,
      'Pintado a mano',
      3
    );

    expect(product.material).toBe('PLA');
    expect(product.height).toBe(10.5);
    expect(product.width).toBe(8.0);
    expect(product.depth).toBe(5.5);
    expect(product.finish).toBe('Pintado a mano');
    expect(product.productionTime).toBe(3);

    expect(product.Material).toBe('PLA');
    expect(product.Height).toBe(10.5);
    expect(product.Width).toBe(8.0);
    expect(product.Depth).toBe(5.5);
    expect(product.Finish).toBe('Pintado a mano');
    expect(product.ProductionTime).toBe(3);
  });

  it('should throw an error when material is invalid', () => {
    expect(() => {
      new Product(10, 'Action Figure', 10, 'Desc', 'img.jpg', 1, 2, undefined, undefined, 'Madera');
    }).toThrow('Invalid material');

    expect(() => {
      new Product(10, 'Action Figure', 10, 'Desc', 'img.jpg', 1, 2, undefined, undefined, 'Otros Madera');
    }).toThrow('Invalid material');
  });

  it('should accept valid materials, including the "Otros: " prefix', () => {
    for (const material of ['PLA', 'Resina', 'PETG', 'Flex', 'Otros: ABS']) {
      expect(() => {
        new Product(10, 'Action Figure', 10, 'Desc', 'img.jpg', 1, 2, undefined, undefined, material);
      }).not.toThrow();
    }
  });

  it('should throw an error when productionTime exceeds 30 days', () => {
    expect(() => {
      new Product(10, 'Action Figure', 10, 'Desc', 'img.jpg', 1, 2, undefined, undefined, 'PLA', 5, 5, 5, 'Finish', 31);
    }).toThrow('Production time must not exceed 30 days');
  });

  it('should create a Product with stock correctly', () => {
    const product = new Product(
      10,
      'Action Figure',
      29.99,
      'Detailed figure',
      'figure.jpg',
      1,
      2,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      7
    );

    expect(product.stock).toBe(7);
    expect(product.Stock).toBe(7);
  });

  it('should throw an error when stock is negative', () => {
    expect(() => {
      new Product(10, 'Action Figure', 10, 'Desc', 'img.jpg', 1, 2, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, -1);
    }).toThrow('Stock must be a non-negative integer');
  });

  it('should throw an error when stock is non-integer', () => {
    expect(() => {
      new Product(10, 'Action Figure', 10, 'Desc', 'img.jpg', 1, 2, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, 2.5);
    }).toThrow('Stock must be a non-negative integer');
  });

  it('should throw an error when dimension attributes are negative', () => {
    expect(() => {
      new Product(10, 'Action Figure', 10, 'Desc', 'img.jpg', 1, 2, undefined, undefined, 'PLA', -1, 5, 5);
    }).toThrow('Height must be greater than or equal to 0');

    expect(() => {
      new Product(10, 'Action Figure', 10, 'Desc', 'img.jpg', 1, 2, undefined, undefined, 'PLA', 5, -1, 5);
    }).toThrow('Width must be greater than or equal to 0');

    expect(() => {
      new Product(10, 'Action Figure', 10, 'Desc', 'img.jpg', 1, 2, undefined, undefined, 'PLA', 5, 5, -1);
    }).toThrow('Depth must be greater than or equal to 0');
  });

  it('should throw an error when productionTime is negative or non-integer', () => {
    expect(() => {
      new Product(10, 'Action Figure', 10, 'Desc', 'img.jpg', 1, 2, undefined, undefined, 'PLA', 5, 5, 5, 'Finish', -3);
    }).toThrow('Production time must be a positive integer');

    expect(() => {
      new Product(10, 'Action Figure', 10, 'Desc', 'img.jpg', 1, 2, undefined, undefined, 'PLA', 5, 5, 5, 'Finish', 0);
    }).toThrow('Production time must be a positive integer');

    expect(() => {
      new Product(10, 'Action Figure', 10, 'Desc', 'img.jpg', 1, 2, undefined, undefined, 'PLA', 5, 5, 5, 'Finish', 2.5);
    }).toThrow('Production time must be a positive integer');
  });
});
