# Delta for User Registration Role

## ADDED Requirements

### Requirement: Registration Rate Limiting

The `POST /users/register` endpoint MUST be protected by a rate limiter with a configurable window and maximum request count. The rate limit configuration MUST be adjustable via environment variables or application configuration. Requests exceeding the limit MUST receive HTTP 429.

#### Scenario: Register rate limit blocks excessive requests

- GIVEN the registration rate limiter is configured with a window and max threshold
- WHEN a client sends requests exceeding the configured maximum within the window
- THEN the response status MUST be 429 Too Many Requests
- AND the response body MUST contain a rate limit error message

#### Scenario: Test environment is exempt from rate limiting

- GIVEN the application is running in a test environment (`NODE_ENV=test`)
- WHEN a client sends multiple registration requests
- THEN the rate limiter MUST NOT block any requests
- AND all requests MUST proceed to the registration handler

## REMOVED Requirements

### Requirement: Duplicate POST /users Route

(Reason: A duplicate `POST /users` route exists alongside the canonical `POST /users/register`. The duplicate creates ambiguity and potential security gaps. Only `POST /users/register` SHALL remain.)
(Migration: All clients using `POST /users` MUST switch to `POST /users/register`.)
