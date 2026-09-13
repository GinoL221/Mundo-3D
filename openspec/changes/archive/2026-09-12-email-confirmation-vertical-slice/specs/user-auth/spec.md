# Delta for User & Auth

## MODIFIED Requirements

### Requirement: Controller Dependency Injection and API JSON Authentication (Sequential Path)

Express controllers handling user registration or login MUST validate syntactic inputs, invoke application use cases through injected infrastructure adapters, and map domain exceptions to the existing structured HTTP responses. Successful registration MUST preserve its current required-image `multipart/form-data` input, HTTP `201` status, response body, immediate cookie-based authenticated session, and redirect behavior. Email-confirmation work MUST NOT change login, logout, cookie, or session contracts.

Newly registered users MUST remain able to log in and use cart, account, checkout, and role-authorized behavior while unverified. Verification MUST NOT become an authorization or access gate in this slice.

(Previously: Required successful API authentication responses to contain a JWT in JSON and prohibited controllers from issuing session cookies, which contradicts the accepted current immediate cookie-session registration behavior.)

#### Scenario: Registration preserves current multipart and session behavior

- GIVEN a guest submits valid registration data with the required profile image as `multipart/form-data`
- WHEN registration succeeds
- THEN the response MUST retain HTTP `201` and its existing response body
- AND the same immediate authentication cookies and redirect behavior MUST be preserved

#### Scenario: Missing image remains rejected

- GIVEN a guest submits registration without the required profile image
- WHEN the request is validated
- THEN registration MUST retain its existing rejection behavior
- AND no user or confirmation token MUST be created

#### Scenario: Unverified user retains existing access

- GIVEN a newly registered user has null `email_verified_at`
- WHEN the user logs in, accesses the account, uses the cart, completes checkout, or exercises an existing role
- THEN each operation MUST follow the same authorization and session behavior as before this change
- AND none MUST be blocked because the user is unverified

#### Scenario: Domain exception remains an HTTP response

- GIVEN registration or login raises an established domain exception
- WHEN the controller maps the failure
- THEN it MUST return the existing structured status and body for that failure
- AND it MUST NOT expose an infrastructure exception

#### Scenario: Concurrent duplicate registration remains compatible

- GIVEN two `POST /api/users/register` requests concurrently submit the same unused email with separate uploaded images
- WHEN both race against the database uniqueness rule
- THEN exactly one request MUST receive HTTP `201`
- AND the other MUST receive the established duplicate-email HTTP `400` response rather than HTTP `500`
- AND the losing upload MUST be cleaned up

#### Scenario: Verification field is absent from unchanged DTOs

- GIVEN no later verification-state consumer decision has been approved
- WHEN registration, login, or user DTOs are returned
- THEN their existing response fields MUST remain unchanged
- AND no verification field name MUST be invented
