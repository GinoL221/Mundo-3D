const request = require('supertest');
const app = require('../app');

jest.mock('../services', () => ({
  UserService: {
    findByEmail: jest.fn(),
    create: jest.fn(),
  },
}));

describe('POST /users registration validation flow', () => {
  it('should handle multiple consecutive validation failures correctly without CSRF errors', async () => {
    // 1. Initial GET to get first CSRF token
    const getRes = await request(app).get('/register');
    let cookies = getRes.headers['set-cookie'];
    
    // Extract CSRF token from HTML
    let match = getRes.text.match(/name="_csrf" value="([a-f0-9]+)"/);
    let csrfToken = match ? match[1] : '';
    expect(csrfToken).not.toBe('');

    // 2. First POST attempt with empty fields
    const postRes1 = await request(app)
      .post(`/users?_csrf=${csrfToken}`)
      .set('Cookie', cookies)
      .field('firstName', '')
      .field('lastName', '')
      .field('email', '')
      .field('password', '')
      .field('confirmPassword', '');

    expect(postRes1.status).toBe(200);
    expect(postRes1.text).toContain('Tienes que ingresar un nombre');
    
    // Update cookies since a new session/cookie state might be returned
    if (postRes1.headers['set-cookie']) {
      cookies = postRes1.headers['set-cookie'];
    }

    // Extract the new CSRF token from the re-rendered HTML page
    match = postRes1.text.match(/name="_csrf" value="([a-f0-9]+)"/);
    const newCsrfToken = match ? match[1] : '';
    expect(newCsrfToken).not.toBe('');
    expect(newCsrfToken).not.toBe(csrfToken); // Token should have rotated

    // 3. Second POST attempt with empty fields using the new rotated CSRF token
    const postRes2 = await request(app)
      .post(`/users?_csrf=${newCsrfToken}`)
      .set('Cookie', cookies)
      .field('firstName', '')
      .field('lastName', '')
      .field('email', '')
      .field('password', '')
      .field('confirmPassword', '');

    // Assert that the second attempt is NOT blocked with a 403 Forbidden!
    expect(postRes2.status).toBe(200);
    expect(postRes2.text).toContain('Tienes que ingresar un nombre');
  });
});
