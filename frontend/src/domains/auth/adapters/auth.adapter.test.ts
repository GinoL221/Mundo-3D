import { describe, expect, it } from 'vitest';
import { createAuthAdapter, createUserAdapter, type APILoginResponse, type APIUser } from './auth.adapter';

function buildAPIUser(overrides: Partial<APIUser> = {}): APIUser {
  return {
    idUser: 1,
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@test.com',
    image: 'ada.jpg',
    idRole: 2,
    ...overrides,
  };
}

describe('createUserAdapter', () => {
  it('maps API field names to the domain User shape', () => {
    const user = createUserAdapter(buildAPIUser());

    expect(user).toEqual({
      id: 1,
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@test.com',
      image: 'ada.jpg',
      idRole: 2,
    });
  });

  it('defaults image to an empty string when null', () => {
    const user = createUserAdapter(buildAPIUser({ image: null }));

    expect(user.image).toBe('');
  });

  it('carries idRole through unchanged (e.g. STAFF)', () => {
    const user = createUserAdapter(buildAPIUser({ idRole: 3 }));

    expect(user.idRole).toBe(3);
  });
});

describe('createAuthAdapter', () => {
  function buildAPILoginResponse(overrides: Partial<APILoginResponse> = {}): APILoginResponse {
    return {
      token: 'jwt-token',
      user: buildAPIUser(),
      ...overrides,
    };
  }

  it('maps token and user into AuthData', () => {
    const auth = createAuthAdapter(buildAPILoginResponse());

    expect(auth.token).toBe('jwt-token');
    expect(auth.user).toEqual({
      id: 1,
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@test.com',
      image: 'ada.jpg',
      idRole: 2,
    });
  });

  it('defaults the nested user image to an empty string when null', () => {
    const auth = createAuthAdapter(buildAPILoginResponse({ user: buildAPIUser({ image: null }) }));

    expect(auth.user.image).toBe('');
  });

  it('carries idRole through the full login round-trip (e.g. ADMIN)', () => {
    const auth = createAuthAdapter(buildAPILoginResponse({ user: buildAPIUser({ idRole: 1 }) }));

    expect(auth.user.idRole).toBe(1);
  });
});
