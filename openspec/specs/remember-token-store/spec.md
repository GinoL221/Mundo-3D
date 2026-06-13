# Remember Token Store Specification

## Purpose
Defines the `RememberToken` Sequelize model and `UserService` helper methods for secure, multi-device remember-me session tokens.

## Requirements

### Requirement: Model Schema and Associations
The system MUST define a `RememberToken` model associated with the `User` model (`User hasMany RememberToken`, `RememberToken belongsTo User`).
Fields:
- `id` (primary key, auto-increment)
- `UserId` (foreign key targeting `User.id`)
- `TokenHash` (string, SHA-256 hash of plain-text token)
- `ExpiresAt` (datetime expiration)

#### Scenario: User association is configured
- GIVEN initialized Sequelize models
- WHEN association mappings execute
- THEN `User.hasMany(RememberToken)` and `RememberToken.belongsTo(User)` SHALL be defined

### Requirement: Service Hashed Token Management
`UserService` MUST expose operations for hashed token management:
- `createRememberToken(userId, plainToken, durationSeconds)`: Hashes token and stores with `ExpiresAt = now + durationSeconds`.
- `verifyRememberToken(plainToken)`: Hashes token, queries database. If active and unexpired, returns `User` record; otherwise returns `null`.
- `deleteRememberToken(plainToken)`: Hashes token and deletes the record from database.

#### Scenario: Creating a token hashes and stores it
- GIVEN a user ID, plain token, and duration
- WHEN `createRememberToken` is called
- THEN SHA-256 hash of the token is saved with calculated expiration date

#### Scenario: Verifying token returns user or cleans up expired
- GIVEN a plain token
- WHEN `verifyRememberToken` is called
- THEN the service SHALL return `User` for valid unexpired tokens, OR delete the record and return `null` if expired

#### Scenario: Deleting token removes it from DB
- GIVEN a valid token
- WHEN `deleteRememberToken` is called
- THEN the corresponding token record is removed
