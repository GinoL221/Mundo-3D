# Upload Middleware Specification

## Purpose

Defines a single parameterizable multer factory that eliminates duplicated upload configuration across route files.

## Requirements

### Requirement: Parameterizable Upload Factory

`src/middlewares/upload.js` MUST export a factory function that accepts a `dest` option and returns a configured multer instance with uuid-based filenames. The factory SHALL accept an options object `{ dest: string }`.

#### Scenario: Factory creates multer for product images

- GIVEN `upload({ dest: 'public/img/products' })` is called
- THEN the returned multer instance SHALL store files in `public/img/products`
- AND filenames SHALL use `uuidv4() + extension`

#### Scenario: Factory creates multer for user images

- GIVEN `upload({ dest: 'public/img/users' })` is called
- THEN the returned multer instance SHALL store files in `public/img/users`
- AND filenames SHALL use `uuidv4() + extension`

### Requirement: Routes Use Shared Factory

`productsRoutes.js` and `userRoutes.js` MUST import from `src/middlewares/upload.js` instead of defining their own `multer.diskStorage` and `uuid` config.

#### Scenario: productsRoutes imports from factory

- GIVEN `productsRoutes.js` after refactoring
- WHEN the file is inspected
- THEN it MUST NOT define `multer.diskStorage` or import `uuid`
- AND it SHALL import `upload` from `../middlewares/upload`
- AND it SHALL use `upload({ dest: '...' }).single('image')`

#### Scenario: userRoutes imports from factory

- GIVEN `userRoutes.js` after refactoring
- WHEN the file is inspected
- THEN it MUST NOT define `multer.diskStorage` or import `uuid`
- AND it SHALL import `upload` from `../middlewares/upload`
