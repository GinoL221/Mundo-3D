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
});
