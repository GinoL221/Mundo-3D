# User & Auth Domain Hexagonal Architecture Specification Delta

This delta specification modifies the user and authentication specification to transition from server-rendered EJS sessions to client-side JWT-based authentication.

## 1. Structural Layering Rules

- **Infrastructure Layer (`src/infrastructure`)**:
  - **Controllers/Middlewares**: 
    (Previously: MUST handle HTTP mapping using camelCase keys (e.g., `req.body.email`). They MUST instantiate adapters, inject them into Use Cases, and handle domain exceptions to return appropriate HTTP responses or render relative views.)
    MUST handle HTTP mapping using camelCase keys (e.g., `req.body.email`). They MUST instantiate adapters, inject them into Use Cases, and handle domain exceptions to return appropriate HTTP responses in JSON format, containing JWT access tokens on success. They MUST NOT render views or issue session cookies.

## 2. BDD Scenarios

### Scenario 4: Controller Dependency Injection and API JSON Authentication
(Previously: Given an Express Controller handling user registration or login
When an HTTP request is received
Then the controller MUST validate syntactic inputs
And it MUST call the appropriate Use Case by injecting the correct infrastructure adapters (Sequelize repositories, Bcrypt/SHA-256 security services)
And it MUST catch Domain Exceptions to render views using relative path syntax (e.g., `res.render('users/login')` or `res.render('users/register')`) without using `path.join` or absolute paths)

Given an Express Controller handling user registration or login
When an HTTP request is received
Then the controller MUST validate syntactic inputs
And it MUST call the appropriate Use Case by injecting the correct infrastructure adapters (Sequelize repositories, Bcrypt/SHA-256 security services)
And it MUST catch Domain Exceptions to return structured JSON responses with an appropriate HTTP status (e.g., 400 Bad Request, 401 Unauthorized)
And on successful authentication (login or register), the response MUST contain the generated JWT token in the JSON body, and the controller MUST NOT issue session cookies or render HTML views
