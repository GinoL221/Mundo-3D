// @ts-ignore
import request from 'supertest';
// @ts-ignore
import app from '../../../app';

const mockGetCartByUserIdExecute = jest.fn();
const mockGetCartDistinctCountExecute = jest.fn();
const mockAuthenticateUserExecute = jest.fn();

// Mock the use cases to avoid hitting real DB/auth logic
jest.mock('../../../application/use-cases/GetCartByUserIdUseCase', () => {
  return {
    GetCartByUserIdUseCase: jest.fn().mockImplementation(() => {
      return {
        execute: (userId: number) => {
          const fn = (global as any).mockGetCartByUserIdExecute || ((global as any).mockGetCartByUserIdExecute = jest.fn());
          return fn(userId);
        },
      };
    }),
  };
});

jest.mock('../../../application/use-cases/GetCartDistinctCountUseCase', () => {
  return {
    GetCartDistinctCountUseCase: jest.fn().mockImplementation(() => {
      return {
        execute: (userId: number) => {
          const fn = (global as any).mockGetCartDistinctCountExecute || ((global as any).mockGetCartDistinctCountExecute = jest.fn());
          return fn(userId);
        },
      };
    }),
  };
});

jest.mock('../../../application/use-cases/AuthenticateUserUseCase', () => {
  return {
    AuthenticateUserUseCase: jest.fn().mockImplementation(() => {
      return {
        execute: (input: any) => {
          const fn = (global as any).mockAuthenticateUserExecute || ((global as any).mockAuthenticateUserExecute = jest.fn());
          return fn(input);
        },
      };
    }),
  };
});

describe('Cart Route E2E / Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global as any).mockGetCartByUserIdExecute = mockGetCartByUserIdExecute;
    (global as any).mockGetCartDistinctCountExecute = mockGetCartDistinctCountExecute;
    (global as any).mockAuthenticateUserExecute = mockAuthenticateUserExecute;
    mockGetCartDistinctCountExecute.mockResolvedValue(0);
  });

  const getCookieString = (res: any) => {
    const cookies = res.headers['set-cookie'];
    if (!cookies) return '';
    return cookies.map((c: string) => c.split(';')[0]).join('; ');
  };

  const getCsrfToken = (html: string) => {
    const match = html.match(/name="_csrf" value="([a-f0-9]+)"/);
    return match ? match[1] : '';
  };

  it('should redirect to /login when user is not authenticated', async () => {
    const res = await request(app).get('/productCart');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/login');
  });

  it('should render the cart page with 200 OK when user is logged in', async () => {
    // 1. Fetch login page to get CSRF token and initial cookie
    const getRes = await request(app).get('/login');
    const csrfToken = getCsrfToken(getRes.text);
    const initialCookies = getCookieString(getRes);

    // 2. Mock authentication use case to log in a user
    mockAuthenticateUserExecute.mockResolvedValue({
      IDUser: 42,
      FirstName: 'John',
      LastName: 'Doe',
      Email: 'john@example.com',
      Image: 'john.png',
      IDRole: 2,
      Category: 'User',
    });

    // 3. Login to establish session
    const loginRes = await request(app)
      .post('/login')
      .set('Cookie', initialCookies)
      .send({
        email: 'john@example.com',
        password: 'password123',
        _csrf: csrfToken,
      });

    expect(loginRes.status).toBe(302);
    const loggedInCookies = getCookieString(loginRes);

    // 4. Mock the cart retrieval use case
    const mockCartResult = {
      items: [
        {
          IDCart: 1,
          IDUser: 42,
          IDProduct: 10,
          Quantity: 1,
          UnitPrice: 150.0,
          CartStatus: 'ACTIVE',
          hasPriceDrift: false,
          product: {
            IDProduct: 10,
            NameProduct: 'Awesome E2E Item',
            Price: 150.0,
            Image: 'e2e.jpg',
          },
        },
      ],
      total: 150.0,
    };
    mockGetCartByUserIdExecute.mockResolvedValue(mockCartResult);
    mockGetCartDistinctCountExecute.mockResolvedValue(1);

    // 5. Request the cart page with the logged-in session cookies
    const cartRes = await request(app)
      .get('/productCart')
      .set('Cookie', loggedInCookies);

    expect(cartRes.status).toBe(200);
    expect(cartRes.text).toContain('Awesome E2E Item');
    expect(cartRes.text).toContain('150');
    expect(mockGetCartByUserIdExecute).toHaveBeenCalledWith(42);
    expect(mockGetCartDistinctCountExecute).toHaveBeenCalledWith(42);
  });
});
