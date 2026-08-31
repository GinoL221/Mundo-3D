# Object Storage Specification

## Purpose

Admin-uploaded product images and user avatars are persisted durably in an S3-compatible
bucket instead of the ephemeral local disk, with no orphaned remote objects on failed writes.

## Requirements

### Requirement: Direct Streaming Upload to S3-Compatible Bucket

In production (`NODE_ENV==='production'`), the upload middleware MUST stream an incoming file
directly to an S3-compatible bucket with no intermediate local disk write. In development and
test environments, a fallback local-disk engine handles uploads identically at the controller
interface. `fileFilter` (jpeg/jpg/png/gif/webp, validated by BOTH file extension and MIME
type) and `limits.fileSize` (5MB) MUST be preserved unchanged from the current disk-based
implementation.

**Change (2026-08-31, object-storage production gate)**: Scenarios below describe production
behavior. The fallback local-disk engine in non-production environments is transparent to
controllers and does not change the upload factory contract.

#### Scenario: Valid image streams directly to the bucket

- GIVEN a multipart form-data request containing a valid jpeg/jpg/png/gif/webp file under 5MB
- WHEN the upload middleware processes the request in production
- THEN the file MUST be uploaded to the bucket without ever being written to local disk
- AND the request MUST proceed to the route handler with the uploaded object's location available

#### Scenario: Oversized or invalid-type file is rejected before upload

- GIVEN a file exceeding 5MB or with a disallowed extension/MIME type
- WHEN the upload middleware processes the request
- THEN it MUST reject the request with the existing validation error behavior
- AND no object MUST be written to the bucket

### Requirement: Full Public URL Persisted for New Uploads

In production (`NODE_ENV==='production'`), every new product image and user avatar upload
MUST persist a full, absolute, provider-hosted URL in the `image` column, not a bare
filename. In development and test environments, the local-disk fallback engine persists a
bare filename; the frontend `resolveImageUrl` function handles both formats transparently.

**Change (2026-08-31, object-storage production gate)**: Scenarios below describe production
behavior where uploads persist absolute bucket URLs. Development/test environments use the
fallback local-disk engine with bare filenames.

#### Scenario: New product image stores an absolute URL

- GIVEN an admin creates or updates a product with an uploaded image
- WHEN the write succeeds in production
- THEN the persisted `image` value MUST be a full absolute URL pointing at the bucket

#### Scenario: New user avatar stores an absolute URL

- GIVEN a user registers with an uploaded avatar image
- WHEN the write succeeds in production
- THEN the persisted `image` value MUST be a full absolute URL pointing at the bucket

### Requirement: Orphaned Remote Object Cleanup on Failed Write

When a create or update operation fails after a file has already been uploaded in production
(e.g. an update targeting a nonexistent product), the newly-uploaded object MUST be deleted
from the bucket. Cleanup MUST operate on the remote object's key/location and MUST NOT
silently no-op when `req.file` has no local filesystem path. In development and test
environments, the local-disk fallback engine's cleanup uses a no-op contract identical to
production's never-throw guarantee.

**Change (2026-08-31, object-storage production gate)**: Scenarios below describe production
behavior using bucket deletion. Development/test environments use the local-disk engine's
equivalent cleanup.

#### Scenario: Failed product update deletes the orphaned object

- GIVEN an admin uploads a new image while updating a product that does not exist (404)
- WHEN the update fails in production
- THEN the object just uploaded MUST be deleted from the bucket
- AND no error MUST surface to the admin beyond the existing 404 response

#### Scenario: Cleanup uses the remote object reference, not a filesystem path

- GIVEN a failed write with a `req.file` produced by the bucket-streaming engine
- WHEN cleanup runs
- THEN it MUST resolve the object to delete from the file's remote key/location
- AND it MUST NOT assume or require a local `.path` property
