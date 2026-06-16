# Product Domain Hexagonal Architecture Specification

This specification defines the architectural rules and non-functional requirements for the Hexagonal Architecture migration of the Product domain slice (including Categories and Franchises).

## 1. Structural Layering Rules
- **Domain Layer (`src/domain`)**: MUST isolate entities and ports. It MUST NOT import from the application or infrastructure layers, nor import any third-party framework or database (e.g. Sequelize, Express).
- **Application Layer (`src/application`)**: MUST isolate Use Cases. They MUST depend only on Domain ports and MUST NOT import from the infrastructure layer. Use Cases MUST return plain DTOs (Data Transfer Objects) and MUST NOT return Sequelize model instances.
- **Infrastructure Layer (`src/infrastructure`)**: MUST handle Express routes, controllers, and Sequelize models. All Sequelize adapters MUST implement Domain Repository Ports and map database models to Domain Entities.
- **TypeScript Compilation**: The compiler configuration MUST enable strict mode (`"strict": true` in `tsconfig.json`) and prohibit any type-casting using `any`.

## 2. BDD Scenarios

### Scenario 1: Domain Layer Isolation
Given a developer writing code within `src/domain`
When importing other modules
Then the import path MUST NOT reference `src/application` or `src/infrastructure`
And the file MUST NOT import Sequelize or any ORM library

### Scenario 2: Use Case Return Contract
Given an application Use Case in `src/application/use-cases`
When the Use Case finishes executing
Then it MUST return a plain JavaScript/TypeScript object representing a DTO
And it MUST NOT return a Sequelize Model instance or any direct database reference

### Scenario 3: Database Port Implementation (Repository Adapter)
Given a Repository Adapter in `src/infrastructure/repositories`
When it implements a Repository Port interface from `src/domain`
Then it MUST use Sequelize models to access database state
And it MUST map the database objects into pure Domain Entities before returning them

### Scenario 4: Request validation and Controller Execution
Given an Express Controller handling a Product request
When a request is received
Then the controller MUST validate request parameters syntactically
And it MUST delegate business execution by calling a Use Case with plain parameters
And the controller MUST capture any business/validation errors to return proper HTTP responses or render EJS templates
