# Delta for Session Cookie Security

## MODIFIED Requirements

### Requirement: CORS Hardening

CORS configuration MUST restrict cross-origin requests using `process.env.CORS_ORIGIN`. If unset, default to the known frontend dev origins. Because the auth cookie now travels with credentialed cross-origin requests, the server MUST echo the exact matched request origin (never a wildcard `*`) and MUST set `Access-Control-Allow-Credentials: true` whenever the request origin is allowed.
(Previously: origin allowlist only; no explicit credentialed-CORS requirement stated.)

#### Scenario: Request from whitelisted or default origin is allowed

- GIVEN `CORS_ORIGIN` is configured or unset
- WHEN a request is received from a whitelisted or default origin
- THEN the response MUST allow the request
- AND `Access-Control-Allow-Origin` MUST echo that exact origin, not `*`

#### Scenario: Request from non-whitelisted origin is rejected

- GIVEN `CORS_ORIGIN` is configured
- WHEN a request is received from an origin not in the whitelist
- THEN the response headers SHALL NOT allow the request

#### Scenario: Credentialed request from allowed origin retains the cookie

- GIVEN a browser sends a cross-origin request with credentials from an allowed origin
- WHEN the server responds
- THEN `Access-Control-Allow-Credentials` MUST be `true`
- AND the browser MUST be able to read the response and retain the auth cookie

## ADDED Requirements

### Requirement: Auth Cookie Security Flags

The JWT auth cookie MUST be set with `httpOnly: true` so client-side JavaScript cannot read it. It MUST include a `secure` flag that is `true` in production and MAY be `false` in local development, and a `SameSite` attribute compatible with the frontend and backend being cross-origin.

#### Scenario: Auth cookie is not readable from JavaScript

- GIVEN a successful login response
- WHEN the browser stores the `Set-Cookie` response
- THEN `document.cookie` MUST NOT expose the auth cookie's value

#### Scenario: Secure flag enforced in production

- GIVEN `NODE_ENV=production`
- WHEN the auth cookie is set
- THEN the cookie's `secure` attribute MUST be `true`
