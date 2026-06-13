# Exploration: auth-hardening-cleanup

### Current State
1. **Remember-Me Cookie Vulnerability & Bug**: In `src/middlewares/userLogged.js`, the middleware checks if a plain-text `userEmail` cookie exists. If present, it retrieves the user from the database and sets it in `res.locals.userLogged`, without checking any signature or token. This is a severe security vulnerability as anyone can spoof the cookie and log in as any user. Furthermore, it fails to set `req.session.userLogged` and `res.locals.isLogged = true`, resulting in a broken session state where the user is not fully authenticated across sessions.
2. **Absolute Path rendering in getAllProducts**: `src/controllers/products/getAllProducts.js` uses `path.join(__dirname, '../../views/products/products.ejs')` to render the view. This is unnecessary and ignores the view resolver configured in `app.js`.
3. **Missing Fields in ProductService.update**: `src/services/productService.js` does not update the `Image`, `IDCategory`, or `IDFranchise` fields. As a result, product updates through the service layer ignore these attributes.
4. **Duplicate Error Rendering in processLogin**: In `src/controllers/users/processLogin.js`, the logic for rendering the invalid credentials error is duplicated across two identical `else` blocks (one for if the user is not found, and another if the password does not match).
5. **Insecure CORS Configuration**: In `src/app.js`, CORS is initialized via `server.use(cors())`, allowing all origins (`*`). This is insecure and does not allow restricting access.

### Affected Areas
- `src/database/models/User.js` — Define a new `RememberToken` column.
- `src/services/userService.js` — Implement `updateRememberToken(id, token)` and `findByRememberToken(token)`.
- `src/middlewares/userLogged.js` — Use signed cookie `remember_token`, hash it with SHA-256, and lookup the user to establish a session.
- `src/controllers/users/processLogin.js` — Generate, hash, and save the remember token when "remember" is checked, set a signed cookie, and simplify the validation/error rendering.
- `src/controllers/users/logout.js` — Delete the remember token in the database for the user, and clear the cookies.
- `src/controllers/products/getAllProducts.js` — Change the absolute path rendering to use the view name `'products/products'`.
- `src/services/productService.js` — Include `Image`, `IDCategory`, and `IDFranchise` in the `update()` logic.
- `src/app.js` — Configure `cookie-parser` with `process.env.SESSION_SECRET` for signed cookie verification, and configure `cors` with `process.env.CORS_ORIGIN`.

### Approaches
1. **Single Token Column in User Model (Option 1)**
   - **Description**: Add `RememberToken` field directly to `User` schema to store a single active remember-me token hash.
   - **Pros**: Straightforward database schema, minimal code complexity, aligns easily with Sequelize.
   - **Cons**: Restricts a user to one active remembered browser session at a time.
   - **Effort**: Low

2. **Separate RememberToken Model / Session Table (Option 2)**
   - **Description**: Create a dedicated table to associate multiple remember-me token hashes to a single user.
   - **Pros**: Allows concurrent active remembered browser sessions on multiple devices.
   - **Cons**: Adds DB design complexity, requires managing token expiration/cleanup routines.
   - **Effort**: Medium-High

### Recommendation
Use **Option 1 (Single Token Column in User Model)**. Since this is an e-commerce course project, supporting one remembered device session is completely sufficient and keeps the codebase simple and clean.

### Risks
- **Sequelize Sync**: While `sequelize.sync()` creates the database tables, if the database tables already exist in local developer machines, developers will need to run the application with `{ alter: true }` temporarily or manually add the column `RememberToken` (or re-seed the DB).
- **Environment Configuration**: `SESSION_SECRET` must be set properly in `.env` to enable signed cookie verification via `cookie-parser`.

### Ready for Proposal
Yes. The next step is to prepare the formal proposal outlining the specifications, changes, and verification plan.
