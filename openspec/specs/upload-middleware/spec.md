# Upload Middleware Specification

## Purpose

Defines a single parameterizable multer factory that eliminates duplicated upload configuration across route files.

## Requirements

### Requirement: Parameterizable Upload Factory for Fetch-based Multipart Data

The parameterizable upload factory MUST process multipart form-data requests sent via
client-side `fetch` from the Astro frontend. The Express middleware MUST parse the uploaded
files, validate constraints (such as max file size and allowed image formats), and handle
upload errors by returning structured JSON error responses rather than rendering HTML error
pages. The factory's destination MUST be an S3-compatible remote bucket, not a local disk
path; `fileFilter` and `limits.fileSize` validation MUST be identical to the prior disk-based
behavior.
(Previously: destination was a local disk path under `public/img/<dest>`.)

**Change (2026-08-31, object-storage production gate)**: In production (`NODE_ENV==='production'`),
the factory streams files directly to an S3-compatible bucket (R2). In development and test
environments, a fallback local-disk engine persists to `public/img/<dest>` for offline iteration.
All scenarios below describe the production behavior; the fallback is transparent to the
controller layer and does not change the architecture of the upload factory contract itself.

#### Scenario: Factory handles successful upload via fetch

- GIVEN an endpoint configured with `upload({ dest: 'products' })`
- WHEN a fetch-based multipart form-data request containing a valid image is received
- THEN the middleware MUST stream the file directly to the bucket under a key namespaced by
  `dest`, using a generated unique filename plus original extension
- AND the controller/route handler MUST return a JSON response containing the uploaded
  object's public URL

#### Scenario: Factory handles file format and size validation errors

- GIVEN an endpoint configured with `upload({ dest: 'products' })`
- WHEN a client sends a fetch-based request with an invalid file format (e.g. text file) or a
  file exceeding size limits
- THEN the upload middleware / error handling middleware MUST catch the multer error
- AND return a 400 Bad Request JSON response with a clear error payload (e.g., `{ error:
  "Invalid file format or size limit exceeded" }`)
- AND no object MUST be uploaded to the bucket

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
