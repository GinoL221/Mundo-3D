# Technical Design: Standardize Naming Conventions (Slice 2A)

This document describes the technical approach for standardizing `Category` and `Franchise` lookup models and associations to camelCase attributes and snake_case database columns, keeping legacy PascalCase properties backward-compatible via getter methods.

## Technical Approach
1. **Database Schema**: MySQL database columns for `Category` (`IDCategory`, `NameCategory`) and `Franchise` (`IDFranchise`, `NameFranchise`) will be physically renamed to snake_case (`id_category`, `name_category`, `id_franchise`, `name_franchise`). Product's foreign keys (`IDCategory`, `IDFranchise`) will also be renamed to snake_case (`id_category`, `id_franchise`).
2. **Sequelize Models**: Attributes in `Category.js`, `Franchise.js`, and foreign keys in `Product.js` will be renamed to camelCase (`idCategory`, `nameCategory`, `idFranchise`, `nameFranchise`). They will map to database columns using `field`.
3. **Backward Compatibility**: `getterMethods` will be added to `Category`, `Franchise`, and `Product` models to return camelCase values when PascalCase names are accessed.
4. **Domain & Application layers**: TypeScript interfaces, domain entities, repositories, and use cases will be refactored to use camelCase properties exclusively.

## Architecture Decisions
- **Foreign Key Updates in Product**: Although modifying the `Product` model is out of scope for general properties, updating its foreign key columns `IDCategory` and `IDFranchise` to `idCategory` and `idFranchise` is within scope as it references Category and Franchise.
- **Sequelize Getters**: Keep getter methods (`IDCategory`, `NameCategory`, etc.) returning their respective camelCase counterpart attributes so legacy controller and view code won't break.

## Data Flow
```
MySQL (id_category, name_category) 
  --> Sequelize Model (idCategory, nameCategory) 
  --> [Optional Getters] (IDCategory, NameCategory)
  --> Repository (maps to Category domain entity)
  --> Domain & Use Cases (camelCase properties)
```

## File Changes
1. `src/database/models/Category.js`: Update fields to `idCategory`, `nameCategory` with corresponding `field` values. Add `getterMethods` for `IDCategory`, `NameCategory`.
2. `src/database/models/Franchise.js`: Update fields to `idFranchise`, `nameFranchise` with corresponding `field` values. Add `getterMethods` for `IDFranchise`, `NameFranchise`.
3. `src/database/models/Product.js`: Update foreign keys `IDCategory`, `IDFranchise` to `idCategory`, `idFranchise` with corresponding `field` values. Add `getterMethods` for `IDCategory`, `IDFranchise`.
4. `src/database/models/index.js`: Update associations to use camelCase foreign keys.
5. `src/database/models/db.d.ts`: Refactor model attribute interfaces (`ProductAttributes`, `CategoryAttributes`, `FranchiseAttributes`) to include both camelCase and legacy PascalCase keys.
6. `src/domain/entities/Category.ts`: Update properties to `idCategory` and `nameCategory`.
7. `src/domain/entities/Franchise.ts`: Update properties to `idFranchise` and `nameFranchise`.
8. `src/domain/entities/Product.ts`: Update constructor parameters to `idCategory`, `idFranchise`.
9. `src/domain/ports/ICategoryRepository.ts` & `IFranchiseRepository.ts`: Update signature parameters to match updated entities.
10. `src/infrastructure/repositories/SequelizeCategoryRepository.ts` & `SequelizeFranchiseRepository.ts`: Update column mappings, queries, and entity creation.
11. `src/application/dtos/CategoryDTO.ts`: Update fields to `idCategory` and `nameCategory`.
12. `src/application/dtos/ProductDTO.ts`: Update fields `IDCategory`/`IDFranchise` to `idCategory`/`idFranchise`.
13. `src/database/seed.js`: Update seed insertion keys to camelCase.
14. Use cases (`CreateProductUseCase.ts`, `UpdateProductUseCase.ts`, `GetLatestProductUseCase.ts`, `GetProductByIdUseCase.ts`, `ListProductsUseCase.ts`): Refactor references to category and franchise entity properties (e.g. `NameCategory` -> `nameCategory`).

## Interfaces/Contracts
### CategoryDTO
```typescript
export interface CategoryDTO {
  idCategory: number;
  nameCategory: string;
}
```

### CategoryAttributes (Sequelize)
```typescript
export interface CategoryAttributes {
  idCategory: number;
  nameCategory: string;
  IDCategory?: number;   // Getter
  NameCategory?: string; // Getter
}
```

## Testing Strategy
- **Unit Tests**: Refactor `SequelizeCategoryRepository.test.ts`, `SequelizeFranchiseRepository.test.ts`, `categoryService.test.js`, and `franchiseService.test.js` mock objects and expectations to camelCase.
- **Domain Tests**: Update `DomainEntities.test.ts` to assert camelCase properties.
- **Use Case Tests**: Refactor mock product payload structures and parameters in `CreateProductUseCase.test.ts`, `UpdateProductUseCase.test.ts`, etc.
- **Execution**: Run `npm test` to verify all test suites.

## Migration/Rollout
- Development environment tables will be altered automatically by `sequelize.sync({ alter: true })`.
- For fresh seeds, running `npm run dev` or resetting via `reset-db.js` will rebuild schema.
- **Rollback Plan**: Revert all file changes to previous git commit. Run database recreation using `reset-db.js` and restart the application.

## Open Questions
None.
