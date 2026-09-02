# Delta for remember-token-store

## MODIFIED Requirements

### Requirement: Model Schema and Associations

The system MUST define a `RememberToken` entity, persisted via `RememberTokenRepositoryPort`, associated with `User` through `idUser` (FK `id_user` → `User.id`, `ON DELETE CASCADE`).
Fields: `idRememberToken` (PK), `idUser`, `tokenHash` (SHA-256 hex, UNIQUE — the lookup key), `expiryDate`, `createdAt`, `familyId` (non-null, indexed — groups one login's rotation chain), `supersededAt` (nullable — non-null once rotated), `successorHash` (nullable — set on rotation; it is a SHA-256 digest, so it identifies the successor row but can never yield the successor token itself, and a grace-window hit therefore issues an access cookie only — see `refresh-token-rotation`), `revokedAt` (nullable — non-null once the family is revoked, e.g. by logout). The four duplicate legacy `UNIQUE KEY token_hash_2..5` indexes MUST be dropped in the same migration; the `token_hash` UNIQUE index remains.
(Previously: specified non-existent PascalCase fields `UserId`/`TokenHash`/`ExpiresAt` with no rotation columns.)

#### Scenario: User association is configured
- GIVEN initialized models
- WHEN association mappings execute
- THEN `User` MUST have many `RememberToken` rows via `id_user`, cascading on delete

#### Scenario: New rows carry rotation metadata
- GIVEN a refresh token is created by login or rotation
- WHEN its row is persisted
- THEN `family_id` MUST be a non-null value
- AND `superseded_at`, `successor_hash`, `revoked_at` MUST be `NULL`

#### Scenario: Legacy duplicate indexes removed
- GIVEN the migration has applied
- WHEN the table schema is inspected
- THEN exactly one UNIQUE index MUST exist on `token_hash`, and `token_hash_2` through `token_hash_5` MUST NOT exist

#### Scenario: Migration down restores the baseline schema exactly
- GIVEN the migration has been applied
- WHEN its `down` logic runs
- THEN `family_id`, `superseded_at`, `successor_hash`, and `revoked_at` MUST be dropped
- AND the four `token_hash_2..5` UNIQUE indexes MUST be recreated, matching the pre-migration baseline exactly

### Requirement: Service Hashed Token Management

Token lifecycle operations MUST be exposed via dedicated use cases, not `UserService`: `CreateRememberTokenUseCase` (hashes the plaintext token via `TokenHasherPort` and stores it with `expiryDate = now + duration`, `idUser`, and a `familyId`), `VerifyRememberTokenUseCase` (hashes the presented token, looks up by `tokenHash`, and returns the associated user only when unexpired and not revoked — deleting the row and returning `null` when merely expired), and `DeleteRememberTokenUseCase` (hashes and deletes by hash).
(Previously: specified non-existent `UserService.createRememberToken/verifyRememberToken/deleteRememberToken` methods and PascalCase fields.)

#### Scenario: Creating a token hashes and stores it
- GIVEN a userId, plaintext token, and duration
- WHEN `CreateRememberTokenUseCase.execute` runs
- THEN the token MUST be hashed via `TokenHasherPort` and stored with `expiryDate = now + duration` and a `familyId`

#### Scenario: Verifying returns the user or cleans up expired
- GIVEN a plaintext token
- WHEN `VerifyRememberTokenUseCase.execute` runs
- THEN it MUST return the associated user for a valid, unexpired, non-revoked token
- AND it MUST delete the row and return `null` when the token is merely expired

#### Scenario: Verifying a revoked token fails without deleting it
- GIVEN a token whose row has `revoked_at` set
- WHEN `VerifyRememberTokenUseCase.execute` runs
- THEN it MUST return `null`
- AND it MUST NOT delete the row

#### Scenario: Deleting removes the record
- GIVEN a valid plaintext token
- WHEN `DeleteRememberTokenUseCase.execute` runs
- THEN the corresponding row MUST be removed from the database
