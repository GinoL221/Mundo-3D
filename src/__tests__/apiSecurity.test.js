const request = require('supertest');

jest.mock('../services', () => ({
  UserService: {
    findByEmail: jest.fn(),
    verifyPassword: jest.fn(),
    findAll: jest.fn(),
    findById: jest.fn(),
    remove: jest.fn(),
  },
}));

const mockAuthenticateUserExecute = jest.fn();

jest.mock('../application/use-cases/AuthenticateUserUseCase', () => {
  return {
    AuthenticateUserUseCase: jest.fn().mockImplementation(() => {
      return {
        execute: (input) => {
          const fn = global.mockAuthenticateUserExecute || (global.mockAuthenticateUserExecute = jest.fn());
          return fn(input);
        },
      };
    }),
  };
});

const { UserService } = require('../services');
const app = require('../app');

/**
 * Integration tests for Phase 4 of api-security-and-admin-guard:
 * exercises the FULL Express stack (sessions, CSRF, adminGuard, isUser,
 * and EJS rendering) through src/app.js via supertest — not isolated
 * middleware/controller calls (those already exist in
 * authMiddleware.test.js and apiUsersLogin.test.js).
 *
 * Scope note 1 — no test database: product routes (productRoutes.ts)
 * ultimately call real Sequelize-backed use cases, and there is no test
 * database connection in this environment (verified: a direct
 * SequelizeConnectionError surfaces in ~60ms, it does not hang). So
 * requests that pass adminGuard but reach the controller fail
 * downstream with a 500 from the global error handler. That 500 is NOT
 * a guard failure — it proves the guard let the request through to the
 * controller, which is exactly what the admin-route-guard spec requires
 * ("the application MUST allow the request to proceed to the
 * controller"). Each "admin allowed" assertion below explicitly checks
 * that the response is NOT a guard-rejection status (401/403) and NOT a
 * redirect to /login, instead of asserting a full 200/302 success that
 * would require a real database.
 *
 * Scope note 2 — login rate limiting: POST /login is capped at 5
 * attempts per 15 minutes per IP by src/middlewares/loginLimiter.js,
 * and every supertest request in this file shares the same in-memory
 * limiter instance. Sessions are therefore established ONCE per role in
 * beforeAll and reused (via the session cookie) across every test below.
 * CSRF tokens rotate per GET/state-changing request, so each mutating
 * request fetches a fresh token first via refreshCsrf() rather than
 * triggering another login.
 *
 * Scope note 3 — CSRF runs before adminGuard: src/app.js registers
 * csrfProtection globally, before any route router. For a true guest
 * (no session at all), POST/PUT/DELETE requests with no `_csrf` body
 * are rejected by CSRF protection with 403 BEFORE adminGuard ever runs
 * — adminGuard's redirect-to-/login branch for guests is only
 * observable on GET requests in this stack. This matches the
 * admin-route-guard spec's intent (administrative routes must reject
 * unauthenticated mutation attempts) even though the literal "redirect
 * to /login" scenario only fires through GET in practice.
 */

const getCookieString = (res) => {
  const cookies = res.headers['set-cookie'];
  if (!cookies) return '';
  return cookies.map((c) => c.split(';')[0]).join('; ');
};

const getCsrfToken = (html) => {
  const match = html.match(/name="_csrf" value="([a-f0-9]+)"/);
  return match ? match[1] : '';
};

/**
 * Logs in as a user with the given role via the real POST /login flow
 * (mocking only AuthenticateUserUseCase), returning the session cookie
 * string needed for subsequent authenticated requests. Only called
 * twice total in this file (once per role) to stay under the login
 * rate limit.
 */
const loginAs = async (userDto) => {
  const getRes = await request(app).get('/login');
  const csrfToken = getCsrfToken(getRes.text);
  const initialCookies = getCookieString(getRes);

  global.mockAuthenticateUserExecute.mockResolvedValueOnce(userDto);

  const loginRes = await request(app)
    .post('/login')
    .set('Cookie', initialCookies)
    .send({
      email: userDto.Email,
      password: 'password123',
      _csrf: csrfToken,
    });

  const cookies = getCookieString(loginRes) || initialCookies;
  return { cookies };
};

/**
 * Fetches a fresh CSRF token bound to an already-authenticated session,
 * since the csrf middleware rotates the token on every GET request.
 * Defaults to GET /users because it is the only mocked, DB-independent
 * route that actually embeds a `_csrf` hidden input in its rendered
 * HTML (the product views require a real database connection that does
 * not exist in this test environment).
 */
const refreshCsrf = async (cookies, path = '/users') => {
  const res = await request(app).get(path).set('Cookie', cookies);
  return getCsrfToken(res.text) || '';
};

const adminUser = {
  IDUser: 1,
  FirstName: 'Admin',
  LastName: 'User',
  Email: 'admin@test.com',
  Image: 'admin.png',
  IDRole: 1,
  Category: 'Admin',
};

const standardUser = {
  IDUser: 2,
  FirstName: 'Standard',
  LastName: 'User',
  Email: 'user@test.com',
  Image: 'user.png',
  IDRole: 2,
  Category: 'User',
};

let adminCookies;
let standardCookies;

beforeAll(async () => {
  global.mockAuthenticateUserExecute = mockAuthenticateUserExecute;
  ({ cookies: adminCookies } = await loginAs(adminUser));
  ({ cookies: standardCookies } = await loginAs(standardUser));
});

beforeEach(() => {
  jest.clearAllMocks();
  global.mockAuthenticateUserExecute = mockAuthenticateUserExecute;
  // GET /users must always render at least one user row so the page
  // includes a `_csrf` hidden input (see refreshCsrf above). Individual
  // describe blocks may override this with more specific fixtures.
  UserService.findAll.mockResolvedValue([
    {
      IDUser: 2,
      FirstName: 'Standard',
      LastName: 'User',
      Email: 'user@test.com',
      Image: '',
    },
  ]);
});

describe('Admin-only product routes (web adminGuard integration)', () => {
  describe('GET /new-product', () => {
    it('redirects an unauthenticated (guest) request to /login', async () => {
      const res = await request(app).get('/new-product');

      expect(res.status).toBe(302);
      expect(res.headers.location).toBe('/login');
    });

    it('returns 403 for an authenticated non-admin user', async () => {
      const res = await request(app).get('/new-product').set('Cookie', standardCookies);

      expect(res.status).toBe(403);
      expect(res.text).toContain('Acceso denegado');
    });

    it('allows an authenticated admin user past the guard (reaches the controller)', async () => {
      const res = await request(app).get('/new-product').set('Cookie', adminCookies);

      // Not a guard rejection: no 401/403 and no redirect to /login.
      // Downstream 500 is expected — no test database is wired for
      // category/franchise repositories in this environment.
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
      expect(res.headers.location).not.toBe('/login');
    });
  });

  describe('POST /products (create)', () => {
    it('rejects an unauthenticated (guest) request before it reaches adminGuard', async () => {
      // CSRF protection (mounted globally, before route routers) rejects
      // any state-changing request without a session-bound _csrf token
      // first. A true guest has no session, so this request never
      // reaches adminGuard at all — it still cannot create a product.
      const res = await request(app).post('/products').send({});

      expect(res.status).toBe(403);
      expect(res.text).toContain('Acceso denegado');
    });

    it('returns 403 for an authenticated non-admin user', async () => {
      const csrfToken = await refreshCsrf(standardCookies);

      const res = await request(app)
        .post('/products')
        .set('Cookie', standardCookies)
        .send({ _csrf: csrfToken, productName: 'Toy' });

      expect(res.status).toBe(403);
      expect(res.text).toContain('Acceso denegado');
    });

    it('allows an authenticated admin user past the guard (reaches the controller)', async () => {
      const csrfToken = await refreshCsrf(adminCookies);

      const res = await request(app)
        .post('/products')
        .set('Cookie', adminCookies)
        .send({ _csrf: csrfToken, productName: 'Toy', price: '10', category: '1', franchise: '1' });

      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
      expect(res.headers.location).not.toBe('/login');
    });
  });

  describe('PUT /product/:id/edit', () => {
    it('rejects an unauthenticated (guest) request before it reaches adminGuard', async () => {
      // See the CSRF-before-adminGuard note in POST /products above.
      const res = await request(app).put('/product/1/edit').send({});

      expect(res.status).toBe(403);
      expect(res.text).toContain('Acceso denegado');
    });

    it('returns 403 for an authenticated non-admin user', async () => {
      const csrfToken = await refreshCsrf(standardCookies);

      const res = await request(app)
        .put('/product/1/edit')
        .set('Cookie', standardCookies)
        .send({ _csrf: csrfToken, productName: 'Toy edited' });

      expect(res.status).toBe(403);
      expect(res.text).toContain('Acceso denegado');
    });

    it('allows an authenticated admin user past the guard (reaches the controller)', async () => {
      const csrfToken = await refreshCsrf(adminCookies);

      const res = await request(app)
        .put('/product/1/edit')
        .set('Cookie', adminCookies)
        .send({ _csrf: csrfToken, productName: 'Toy edited' });

      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
      expect(res.headers.location).not.toBe('/login');
    });
  });

  describe('DELETE /product/delete/:id', () => {
    it('rejects an unauthenticated (guest) request before it reaches adminGuard', async () => {
      // See the CSRF-before-adminGuard note in POST /products above.
      const res = await request(app).delete('/product/delete/1');

      expect(res.status).toBe(403);
      expect(res.text).toContain('Acceso denegado');
    });

    it('returns 403 for an authenticated non-admin user', async () => {
      const csrfToken = await refreshCsrf(standardCookies);

      const res = await request(app)
        .delete('/product/delete/1')
        .set('Cookie', standardCookies)
        .send({ _csrf: csrfToken });

      expect(res.status).toBe(403);
      expect(res.text).toContain('Acceso denegado');
    });

    it('allows an authenticated admin user past the guard (reaches the controller)', async () => {
      const csrfToken = await refreshCsrf(adminCookies);

      const res = await request(app)
        .delete('/product/delete/1')
        .set('Cookie', adminCookies)
        .send({ _csrf: csrfToken });

      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
      expect(res.headers.location).not.toBe('/login');
    });
  });
});

describe('/productCart route still uses isUser (any logged-in user, not admin-only)', () => {
  it('redirects an unauthenticated (guest) request to /login', async () => {
    const res = await request(app).get('/productCart');

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/login');
  });

  it('allows an authenticated standard (non-admin) user past the guard', async () => {
    const res = await request(app).get('/productCart').set('Cookie', standardCookies);

    // isUser only checks res.locals.isLogged — a standard user must not
    // be rejected with 403 the way adminGuard would reject them.
    expect(res.status).not.toBe(403);
    expect(res.headers.location).not.toBe('/login');
  });

  it('allows an authenticated admin user past the guard as well', async () => {
    const res = await request(app).get('/productCart').set('Cookie', adminCookies);

    expect(res.status).not.toBe(403);
    expect(res.headers.location).not.toBe('/login');
  });
});

describe('DELETE /users/delete/:id (web adminGuard integration)', () => {
  it('rejects an unauthenticated (guest) request before it reaches adminGuard', async () => {
    // See the CSRF-before-adminGuard note in the product routes above.
    const res = await request(app).delete('/users/delete/2');

    expect(res.status).toBe(403);
    expect(res.text).toContain('Acceso denegado');
  });

  it('returns 403 for an authenticated non-admin user', async () => {
    const csrfToken = await refreshCsrf(standardCookies, '/users');

    const res = await request(app)
      .delete('/users/delete/2')
      .set('Cookie', standardCookies)
      .send({ _csrf: csrfToken });

    expect(res.status).toBe(403);
    expect(res.text).toContain('Acceso denegado');
    expect(UserService.remove).not.toHaveBeenCalled();
  });

  it('allows an authenticated admin user past the guard and completes the deletion', async () => {
    // Unlike the product routes, deleteUser only depends on the mocked
    // UserService (not a real Sequelize connection), so this assertion
    // can verify the full success path end-to-end instead of just
    // "not rejected by the guard".
    const csrfToken = await refreshCsrf(adminCookies, '/users');
    UserService.remove.mockResolvedValue(true);

    const res = await request(app)
      .delete('/users/delete/2')
      .set('Cookie', adminCookies)
      .send({ _csrf: csrfToken });

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/users');
    expect(UserService.remove).toHaveBeenCalledWith('2');
  });
});

describe('GET /users (EJS view gating for the "Borrar" delete button and the "Nuevo producto" link)', () => {
  it('does not render the delete form/button or the "Nuevo producto" link for a standard (non-admin) user', async () => {
    const res = await request(app).get('/users').set('Cookie', standardCookies);

    expect(res.status).toBe(200);
    expect(res.text).not.toContain('Borrar');
    expect(res.text).not.toContain('/users/delete/');
    expect(res.text).not.toContain('Nuevo producto');
  });

  it('renders the delete form/button and the "Nuevo producto" link for an admin user', async () => {
    const res = await request(app).get('/users').set('Cookie', adminCookies);

    expect(res.status).toBe(200);
    expect(res.text).toContain('Borrar');
    expect(res.text).toContain('/users/delete/2');
    expect(res.text).toContain('Nuevo producto');
  });
});
