# Delta for Schema Migrations

## ADDED Requirements

### Requirement: Email Verification Migration and Existing-User Backfill

The migration MUST add nullable `email_verified_at` state to users and a dedicated confirmation-token store containing a user reference, SHA-256 token digest, expiry, consumed timestamp, and creation timestamp. It MUST backfill every user that existed before the migration with `email_verified_at` set to the migration timestamp while leaving users created afterward unverified by default. Its `down` path MUST safely remove the new token structures and verification column without changing pre-existing registration, session, login, or checkout data.

#### Scenario: Existing users are backfilled as verified

- GIVEN users exist before the migration runs
- WHEN the migration commits
- THEN each pre-existing user MUST have a non-null `email_verified_at` set to the migration timestamp

#### Scenario: New-user default remains unverified

- GIVEN the migration has been applied
- WHEN a new user row is created without an explicit verification timestamp
- THEN `email_verified_at` MUST be null

#### Scenario: Token persistence has required security fields

- GIVEN the migration has been applied
- WHEN the confirmation-token store is inspected
- THEN it MUST support a user reference, token digest, expiry, consumed timestamp, and creation timestamp
- AND it MUST NOT require or provide a plaintext-token field

#### Scenario: Migration rollback is safe

- GIVEN the email-verification migration is the most recently applied migration
- WHEN its `down` logic runs
- THEN the confirmation-token structures and `email_verified_at` column MUST be removed in dependency-safe order
- AND existing user, session, login, and checkout data MUST otherwise remain unchanged

#### Scenario: Real-database migration evidence covers backfill

- GIVEN a real test database contains pre-existing users
- WHEN the migration and its rollback evidence execute
- THEN the evidence MUST prove existing-user backfill, the null default for later users, required token fields, and a safe down path
