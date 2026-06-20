# Proposal: Standardize Naming Conventions (Slice 2A)

## In Scope
- Rename Category (`IDCategory`, `NameCategory`) and Franchise (`IDFranchise`, `NameFranchise`) database columns to snake_case (`id_category`, `name_category`, `id_franchise`, `name_franchise`).
- Map renamed database columns to camelCase attributes (`idCategory`, `nameCategory`, `idFranchise`, `nameFranchise`) in Sequelize models using `field` mappings.
- Preserve backward compatibility by keeping getterMethods (`IDCategory`, `NameCategory`, `IDFranchise`, `NameFranchise`) in Sequelize models.
- Refactor Category & Franchise domain entities, DTOs, repositories, and unit/integration tests to use camelCase naming conventions.
- Update database seeding (`seed.js`) and database migrations/setup scripts.

## Out of Scope
- Modifying other tables or models (like Product or User) beyond updating foreign key properties that reference Category or Franchise.
- Modifying frontend application code.

## New/Modified Capabilities
- Consistent camelCase API and Domain properties for Category and Franchise, aligned with the User model.
- Standardized snake_case database schema for Category and Franchise lookup tables.

## Approach
1. **Database Schema**: Implement a migration to physically rename Category/Franchise columns in MySQL to snake_case.
2. **Sequelize Models**:
   - Update `Category.js` and `Franchise.js` attribute definitions to camelCase, specifying `field` for database columns.
   - Maintain `getterMethods` to map camelCase properties back to PascalCase for backward compatibility.
3. **Domain Layer**:
   - Refactor `Category.ts` and `Franchise.ts` entities to camelCase properties.
   - Refactor `CategoryDTO.ts` and any Franchise DTOs to camelCase.
4. **Data Access Layer**:
   - Refactor `SequelizeCategoryRepository.ts` and `SequelizeFranchiseRepository.ts` to map columns/entities correctly using camelCase.
5. **Seeding & Tests**:
   - Update `seed.js` to insert data with the new model definition structure.
   - Refactor repository and domain tests to reflect new property names.

## Affected Areas
- `src/database/models/Category.js`
- `src/database/models/Franchise.js`
- `src/domain/entities/Category.ts`
- `src/domain/entities/Franchise.ts`
- `src/infrastructure/repositories/SequelizeCategoryRepository.ts`
- `src/infrastructure/repositories/SequelizeFranchiseRepository.ts`
- `src/application/dtos/CategoryDTO.ts`
- `src/database/seed.js`
- Tests under `src/infrastructure/repositories/__tests__/` and `src/__tests__/`

## Risks
- Regression in endpoints expecting PascalCase JSON. *Mitigation*: Getter methods preserved.
- Existing database references breaking. *Mitigation*: Run migration and seeding scripts to align columns.

## Rollback Plan
- Revert all code changes to the previous commit.
- Run database down migration to rename columns back to PascalCase.

## Success Criteria
- All tests pass successfully.
- Codebase uses camelCase internally for Category/Franchise while keeping PascalCase compatibility at model boundaries.
