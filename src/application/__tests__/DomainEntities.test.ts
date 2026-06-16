import { Product } from '../../domain/entities/Product';
import { Category } from '../../domain/entities/Category';
import { Franchise } from '../../domain/entities/Franchise';

describe('Domain Entities', () => {
  it('should create a Category entity correctly', () => {
    const category = new Category(1, 'Figures');
    expect(category.IDCategory).toBe(1);
    expect(category.NameCategory).toBe('Figures');
  });

  it('should create a Franchise entity correctly', () => {
    const franchise = new Franchise(2, 'Star Wars');
    expect(franchise.IDFranchise).toBe(2);
    expect(franchise.NameFranchise).toBe('Star Wars');
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

    expect(product.IDProduct).toBe(10);
    expect(product.NameProduct).toBe('Action Figure');
    expect(product.Price).toBe(29.99);
    expect(product.DescriptionProduct).toBe('Detailed figure');
    expect(product.Image).toBe('figure.jpg');
    expect(product.IDCategory).toBe(1);
    expect(product.IDFranchise).toBe(2);
    expect(product.Category).toBe(category);
    expect(product.Franchise).toBe(franchise);
  });
});
