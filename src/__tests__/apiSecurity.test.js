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

const getCookieString = (res) => {
  const cookies = res.headers['set-cookie'];
  if (!cookies) return '';
  return cookies.map((c) => c.split(';')[0]).join('; ');
};

const getCsrfToken = (html) => {
  const match = html.match(/name="_csrf" value="([a-f0-9]+)"/);
  return match ? match[1] : '';
};

const loginAs = async (userDto) => {
  const getRes = await request(app).get('/login');
  const csrfToken = getCsrfToken(getRes.text);
  const initialCookies = getCookieString(getRes);

  global.mockAuthenticateUserExecute.mockResolvedValueOnce(userDto);

  const loginRes = await request(app)
    .post('/login')
    .set('Cookie', initialCookies)
    .send({
      email: userDto.email,
      password: 'password123',
      _csrf: csrfToken,
    });

  const cookies = getCookieString(loginRes) || initialCookies;
  return { cookies };
};

const refreshCsrf = async (cookies, path = '/users') => {
  const res = await request(app).get(path).set('Cookie', cookies);
  return getCsrfToken(res.text) || '';
};

const adminUser = {
  idUser: 1,
  firstName: 'Admin',
  lastName: 'User',
  email: 'admin@test.com',
  image: 'admin.png',
  idRole: 1,
  category: 'Admin',
};

const standardUser = {
  idUser: 2,
  firstName: 'Standard',
  lastName: 'User',
  email: 'user@test.com',
  image: 'user.png',
  idRole: 2,
  category: 'User',
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
  UserService.findAll.mockResolvedValue([
    {
      idUser: 2,
      IDUser: 2,
      firstName: 'Standard',
      FirstName: 'Standard',
      lastName: 'User',
      LastName: 'User',
      email: 'user@test.com',
      Email: 'user@test.com',
      image: '',
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

      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
      expect(res.headers.location).not.toBe('/login');
    });
  });

  describe('POST /products (create)', () => {
    it('rejects an unauthenticated (guest) request before it reaches adminGuard', async () => {
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
