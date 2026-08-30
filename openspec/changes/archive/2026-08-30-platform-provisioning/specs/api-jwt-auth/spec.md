# Delta for API JWT Authentication

## ADDED Requirements

### Requirement: Proxy-Aware Login Rate Limiting

When the application runs behind exactly one proxy hop, the login rate limiter MUST key on the real client IP taken from the forwarded client address, not on the proxy's own IP. A single client that exhausts `process.env.LOGIN_LIMIT_MAX` failed attempts within `process.env.LOGIN_LIMIT_WINDOW` MUST NOT cause requests from other clients (different source IPs) to receive `429 Too Many Requests`.

#### Scenario: One client's rate limit does not lock out other clients

- GIVEN the app runs behind one proxy hop and client A has exceeded `LOGIN_LIMIT_MAX` within `LOGIN_LIMIT_WINDOW`
- WHEN client B, from a different source IP, sends its first login request
- THEN client B MUST NOT receive `429`
- AND client A MUST receive `429`

#### Scenario: Rate limiting buckets by the forwarded client IP

- GIVEN login requests arrive through the edge proxy carrying an `X-Forwarded-For` client IP
- WHEN the login limiter counts attempts
- THEN it MUST bucket attempts by the forwarded client IP rather than the proxy's IP
