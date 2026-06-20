# Upload Middleware Specification Delta

This delta specification defines updates to the upload middleware to support and validate fetch-based multipart form-data requests, returning JSON error or success responses.

## Requirements

### Requirement: Parameterizable Upload Factory for Fetch-based Multipart Data
(Previously: `src/middlewares/upload.js` MUST export a factory function that accepts a `dest` option and returns a configured multer instance with uuid-based filenames. The factory SHALL accept an options object `{ dest: string }`.)

The parameterizable upload factory MUST process multipart form-data requests sent via client-side `fetch` from the Astro frontend. The Express middleware MUST parse the uploaded files, validate constraints (such as max file size and allowed image formats), and handle upload errors by returning structured JSON error responses rather than rendering HTML error pages.

#### Scenario: Factory handles successful upload via fetch
(Previously: 
- GIVEN `upload({ dest: 'public/img/products' })` is called
- THEN the returned multer instance SHALL store files in `public/img/products`
- AND filenames SHALL use `uuidv4() + extension`)

- GIVEN an endpoint configured with `upload({ dest: 'public/img/products' })`
- WHEN a fetch-based multipart form-data request containing a valid image is received
- THEN the middleware MUST save the file to `public/img/products` using `uuidv4() + extension`
- AND the controller/route handler MUST return a JSON response containing the saved file details

#### Scenario: Factory handles file format and size validation errors
- GIVEN an endpoint configured with `upload({ dest: 'public/img/products' })`
- WHEN a client sends a fetch-based request with an invalid file format (e.g. text file) or a file exceeding size limits
- THEN the upload middleware / error handling middleware MUST catch the multer error
- AND return a 400 Bad Request JSON response with a clear error payload (e.g., `{ error: "Invalid file format or size limit exceeded" }`)
