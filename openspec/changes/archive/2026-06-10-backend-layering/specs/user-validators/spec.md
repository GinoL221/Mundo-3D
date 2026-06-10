# User Validators Specification

## Purpose

Defines express-validator chains for user registration and login forms, extracted from route files into dedicated validator modules.

## Requirements

### Requirement: User Registration Validators Module

`src/middlewares/validators/userValidators.js` MUST export `validationsUsers` — the complete express-validator chain currently defined inline in `userRoutes.js` (firstName, lastName, email, password, image validation).

#### Scenario: validationsUsers preserves identical validation logic

- GIVEN the existing `validationsUsers` array from `userRoutes.js`
- WHEN the validator chain is moved to `userValidators.js`
- THEN each field rule SHALL produce the same validation errors
- AND the exported array SHALL be directly usable as route middleware

### Requirement: Login Validators Module

`src/middlewares/validators/userValidators.js` MUST also export `loginValidation` — the express-validator chain currently defined inline in `userRoutes.js` (email, password validation).

#### Scenario: loginValidation preserves identical validation logic

- GIVEN the existing `loginValidation` array from `userRoutes.js`
- WHEN the validator chain is moved to `userValidators.js`
- THEN it SHALL produce the same validation errors for email format and password length

### Requirement: userRoutes Imports Validators

`userRoutes.js` MUST import `validationsUsers` and `loginValidation` from the validators module instead of defining them inline.

#### Scenario: userRoutes no longer defines validator chains

- GIVEN `userRoutes.js` after refactoring
- THEN it SHALL import validators from `../middlewares/validators/userValidators`
- AND it MUST NOT define `body()` chains inline
