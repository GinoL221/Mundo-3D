import fs from 'fs';
import path from 'path';
import swaggerJsdoc from 'swagger-jsdoc';
import { openapiSchemas } from './openapiSchemas';

// Read (not `require`) package.json for the version, so this stays a plain
// file read rather than a module import — no resolveJsonModule tsconfig
// change needed, and it sidesteps `@typescript-eslint/no-require-imports`.
// backend/package.json sits 3 levels above both src/infrastructure/openapi/
// and dist/infrastructure/openapi/, so the same relative path resolves in
// both dev (ts-node) and compiled (RUN_COMPILED=true) modes.
const PACKAGE_JSON_PATH = path.join(__dirname, '..', '..', '..', 'package.json');
const { version } = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf-8')) as { version: string };

// Glob patterns for the 6 route groups' `@openapi` JSDoc annotations.
// swagger-jsdoc extracts comment blocks as raw text, so both the TypeScript
// sources (dev/test, run via ts-node/ts-jest) and the compiled JS output
// (RUN_COMPILED=true production, see index.js) resolve correctly — a
// non-matching pattern simply contributes zero files, it never errors.
const ROUTES_GLOB_TS = path.join(__dirname, '..', 'routes', 'api', '*.ts');
const ROUTES_GLOB_JS = path.join(__dirname, '..', 'routes', 'api', '*.js');

// `apiAuthMiddleware` reads the `m3d_auth` httpOnly JWT cookie; `csrfGuard`
// additionally requires the `x-csrf-token` header (matched against the
// `m3d_csrf` cookie) on unsafe methods once authenticated — see
// src/infrastructure/middlewares/auth.ts and csrf.ts. Modeled as two
// independent apiKey schemes (documentation only — this repo has no OAuth2
// precedent to justify a heavier scheme).
const definition = {
  openapi: '3.0.0',
  info: {
    title: 'Mundo-3D API',
    version,
    description: 'REST API for the Mundo-3D storefront and admin backend.',
  },
  servers: [{ url: '/api' }],
  components: {
    schemas: openapiSchemas,
    securitySchemes: {
      cookieAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'm3d_auth',
        description: 'JWT issued on login/register, required by apiAuthMiddleware.',
      },
      csrfHeader: {
        type: 'apiKey',
        in: 'header',
        name: 'x-csrf-token',
        description: 'Required by csrfGuard on unsafe methods (POST/PUT/PATCH/DELETE) for authenticated routes.',
      },
    },
  },
};

export function buildOpenApiSpec(): object {
  return swaggerJsdoc({
    definition,
    apis: [ROUTES_GLOB_TS, ROUTES_GLOB_JS],
  });
}
