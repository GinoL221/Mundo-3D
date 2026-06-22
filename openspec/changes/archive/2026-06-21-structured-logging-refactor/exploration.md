# Exploration Report: Structured Logging Refactor

This report analyzes the current state of console logging in the codebase and proposes a transition to a structured logging system.

## 1. Codebase Exploration Findings

A search for `console.log` and `console.error` inside the `src/` directory identified the following instances:

### Application Middlewares
- **[cartCount.ts](file:///home/ginopc/Desarrollo/Mundo-3D/src/infrastructure/middlewares/cartCount.ts#L19)**:
  - `console.error('Error computing cart count:', error.message);`
- **[errorHandler.ts](file:///home/ginopc/Desarrollo/Mundo-3D/src/infrastructure/middlewares/errorHandler.ts#L11-L14)**:
  - `console.error('[ERROR]', err.message || err);`
  - `console.error(err.stack);`
- **[userLogged.ts](file:///home/ginopc/Desarrollo/Mundo-3D/src/infrastructure/middlewares/userLogged.ts#L64)**:
  - `console.error('Error al verificar remember_token:', error);`

### Database Utility Scripts
- **[reset-db.js](file:///home/ginopc/Desarrollo/Mundo-3D/src/database/reset-db.js)** (4 instances):
  - Used for CLI feedback (`console.log`) and script error reporting (`console.error`).
- **[seed.js](file:///home/ginopc/Desarrollo/Mundo-3D/src/database/seed.js)** (5 instances):
  - Used for CLI execution progress feedback (`console.log`) and error reporting (`console.error`).

### Test Mocks
- **[errorHandler.test.ts](file:///home/ginopc/Desarrollo/Mundo-3D/src/infrastructure/middlewares/__tests__/errorHandler.test.ts#L18)**:
  - `consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});`

---

## 2. Technical Options Comparison

To establish structured logging, we compare two primary choices in the Node.js ecosystem: **Winston** vs. **Pino**.

| Criteria | Winston | Pino |
| :--- | :--- | :--- |
| **Performance** | Medium (allocates log objects, slower serialization) | **High** (extremely fast, early serialization to JSON string) |
| **Package Size** | Larger (~300kB minified, rich dependency tree) | **Very Small** (~30kB minified, highly lightweight) |
| **JSON Logging** | Supported via format configurations | Supported natively by default |
| **Dev Formatting** | Built-in colorization/simple formats | Requires `pino-pretty` (as a devDependency) |
| **Ecosystem** | Massive (many transport plugins for DBs, APIs) | Large (uses external processes/transports) |
| **TypeScript Support** | Good (with typings) | Excellent (built-in typings) |

### Recommendation
We recommend **Pino** for the following reasons:
1. **Performance**: In an Express application, high performance and low event-loop block times are critical. Pino is designed specifically to optimize logging performance.
2. **Standard Output**: Modern logging best practices (12-Factor App) dictate writing logs to standard output as a stream of JSON and letting the container orchestration (e.g., Docker, Kubernetes, Cloud Logging) handle routing and storage. Pino aligns perfectly with this philosophy.
3. **Simplicity**: Its setup is simple and has very low overhead.

---

## 3. Logger Interface Design

We propose exposing the logger as a singleton helper in `src/infrastructure/logging/logger.ts`.

### Design Implementation Draft

```typescript
import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

const logger = pino({
  level: process.env.LOG_LEVEL || (isTest ? 'silent' : 'info'),
  transport: !isProduction && !isTest ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  } : undefined,
});

export default logger;
```

### Key Highlights:
- **TypeScript Conformity**: Fully type-safe without using the `any` keyword.
- **Production JSON**: Logs raw JSON to stdout/stderr in production.
- **Development Friendliness**: Uses `pino-pretty` for human-readable colorized output locally.
- **Silent Tests**: Automatically defaults to `silent` level in test environments, preventing test output pollution.

---

## 4. Transition Plan & Jest Considerations

### Step 1: Install Dependencies
Add `pino` to production dependencies and `pino-pretty` to development dependencies:
```bash
npm install pino
npm install --save-dev pino-pretty
```

### Step 2: Establish the Logger Singleton
Create `src/infrastructure/logging/logger.ts` with the proposed design.

### Step 3: Replace Console Logs in Application Code
Replace imports and calls in:
- `src/infrastructure/middlewares/cartCount.ts`
- `src/infrastructure/middlewares/errorHandler.ts`
- `src/infrastructure/middlewares/userLogged.ts`

### Step 4: Handle Database Scripts (Optional but Recommended)
Since `reset-db.js` and `seed.js` are pure Javascript CLI scripts, we can either:
- Leave them using `console` since they are admin utility scripts meant for stdout output directly.
- Convert them to use the logger by registering `ts-node` or importing the transpiled logger module.
*Recommendation:* Keep them as `console` or migrate them to use a custom simple CLI logger to avoid mixing application logs with database administration scripts.

### Step 5: Adapt Jest Tests
- In `errorHandler.test.ts`, since the logger is automatically silenced when `NODE_ENV === 'test'`, we do not need to mock `console.error` to avoid CLI pollution.
- However, if the test asserts that an error is logged, we can import `logger` and use `jest.spyOn(logger, 'error')` instead of `jest.spyOn(console, 'error')`.
