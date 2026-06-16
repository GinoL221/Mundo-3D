# Technical Design: Product Domain Hexagonal Architecture

This document defines the technical design for migrating the Product domain slice to TypeScript and Clean/Hexagonal Architecture.

## 1. TypeScript & Build Configuration

To support TypeScript strict compilation rules:
- **TypeScript Config (`tsconfig.json`)**: Configure target to `ES2022`, module to `CommonJS`, and activate strict type checks:
  ```json
  {
    "compilerOptions": {
      "target": "es2022",
      "module": "commonjs",
      "rootDir": "./src",
      "outDir": "./dist",
      "strict": true,
      "noImplicitAny": true,
      "strictNullChecks": true,
      "esModuleInterop": true,
      "skipLibCheck": true,
      "forceConsistentCasingInFileNames": true
    },
    "include": ["src/**/*"]
  }
  ```
- **Dependencies**: Add `typescript`, `ts-node`, `ts-jest`, and `@types/express` to development dependencies.

## 2. Directory Structure

The new structure organizes code into strict layers:

| Layer | Directory | Responsibility / Constraints |
| :--- | :--- | :--- |
| **Domain** | `src/domain/entities` | Core business concepts (Product, Category, Franchise). Zero outer imports. |
| | `src/domain/ports` | Interfaces defining database behavior (Ports). |
| **Application** | `src/application/use-cases` | Use cases implementing user goals. Depend *only* on domain ports. |
| | `src/application/dtos` | Data Transfer Objects protecting core entities from leaking. |
| **Infrastructure**| `src/infrastructure/repositories`| Database adapters implementing Ports via Sequelize. |
| | `src/infrastructure/controllers` | Express controllers handling request validation and EJS rendering. |
| | `src/infrastructure/routes` | Setup express routing and Dependency Injection. |

## 3. Interfaces & Domain Entities

### Domain Entities
```typescript
// src/domain/entities/Category.ts
export class Category {
  constructor(public readonly id: number, public readonly name: string) {}
}

// src/domain/entities/Product.ts
import { Category } from './Category';

export class Product {
  constructor(
    public readonly id: number,
    public readonly name: string,
    public readonly price: number,
    public readonly description: string | null,
    public readonly image: string | null,
    public readonly categoryId: number,
    public readonly franchiseId: number,
    public readonly category?: Category
  ) {}
}
```

### Repository Ports
```typescript
// src/domain/ports/IProductRepository.ts
import { Product } from '../entities/Product';

export interface IProductRepository {
  findAll(): Promise<Product[]>;
  findById(id: number): Promise<Product | null>;
  findLatest(): Promise<Product | null>;
  update(id: number, data: Partial<Product>): Promise<Product | null>;
}
```

## 4. Use Case Design & DTOs

Use cases accept constructor parameters implementing port interfaces and perform business logic.

```typescript
// src/application/dtos/ProductDTO.ts
export interface ProductDTO {
  IDProduct: number;
  NameProduct: string;
  Price: number;
  DescriptionProduct: string | null;
  Image: string | null;
  Category: string;
}

// src/application/use-cases/ListProducts.ts
import { IProductRepository } from '../../domain/ports/IProductRepository';
import { ProductDTO } from '../dtos/ProductDTO';

export class ListProducts {
  constructor(private productRepo: IProductRepository) {}

  async execute(): Promise<{ count: number; products: ProductDTO[]; countByCategory: Record<string, number> }> {
    const products = await this.productRepo.findAll();
    const countByCategory: Record<string, number> = {};
    
    const mapped = products.map(p => {
      const catName = p.category ? p.category.name : 'Sin categoría';
      countByCategory[catName] = (countByCategory[catName] || 0) + 1;
      return {
        IDProduct: p.id,
        NameProduct: p.name,
        Price: p.price,
        DescriptionProduct: p.description,
        Image: p.image,
        Category: catName
      };
    });

    return { count: products.length, products: mapped, countByCategory };
  }
}
```

## 5. Express Controller Adapter Integration

Controllers manage HTTP requests, syntactic validations, error catching, and view rendering.

```typescript
// src/infrastructure/controllers/ProductController.ts
import { Request, Response, NextFunction } from 'express';
import { ListProducts } from '../../application/use-cases/ListProducts';

export class ProductController {
  constructor(private listProductsUseCase: ListProducts) {}

  async getAllProducts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Syntactic validation of request params
      const result = await this.listProductsUseCase.execute();
      res.render('products/allProducts', {
        allProducts: result.products,
        count: result.count,
        countByCategory: result.countByCategory
      });
    } catch (error) {
      next(error); // Error propagation to Express middleware
    }
  };
}
```

## 6. Testing Strategy

| Target | Focus | Execution Details |
| :--- | :--- | :--- |
| **Domain Entities** | State & logic validation | Unit tests without external dependencies or database. |
| **Use Cases** | Workflow & DTO output | Mock `IProductRepository` using Jest. Verify output structure and counts. |
| **Sequelize Repository** | Data Mapping & Queries | Integration tests using a test SQLite database instance. Assert entity conversion. |
