import fs from 'fs';
import path from 'path';
import type { RequestHandler } from 'express';
import { logger } from '../logging/logger';

// Committed, build-time-generated contract (see scripts/generate-openapi-spec.js
// and the `generate:openapi`/`check:openapi` scripts). __dirname resolves
// identically from src/infrastructure/openapi/ (ts-node/dev/test) and
// dist/infrastructure/openapi/ (compiled), matching openapiSpec.ts's
// PACKAGE_JSON_PATH resolution — never derived from request input.
export const OPENAPI_ARTIFACT_PATH = path.join(__dirname, '..', '..', '..', 'openapi.json');

// Reads the committed artifact as inert data — never `require()`d (which
// would execute module resolution) and never JSON.parse'd here, so the
// route can serve the exact bytes untouched. Returns null instead of
// throwing on any read failure (missing file, permissions, etc.): a
// missing documentation artifact must not crash the process.
export function loadOpenApiArtifact(artifactPath: string = OPENAPI_ARTIFACT_PATH): string | null {
  try {
    return fs.readFileSync(artifactPath, 'utf-8');
  } catch {
    return null;
  }
}

const defaultArtifact = loadOpenApiArtifact();

if (defaultArtifact === null) {
  logger.warn(
    { event: 'openapi_artifact_missing', path: OPENAPI_ARTIFACT_PATH },
    'Committed OpenAPI artifact is missing or unreadable; GET /api/openapi.json will respond 404.'
  );
}

// Factory (rather than a bare handler) keeps the composition root
// (routes/api/index.ts) thin and makes the 404 branch unit-testable without
// mocking `fs` — the artifact is injected directly.
export function createOpenApiRouteHandler(artifact: string | null = defaultArtifact): RequestHandler {
  return (_req, res) => {
    if (artifact === null) {
      res.status(404).json({ error: 'OpenAPI contract artifact is not available.' });
      return;
    }

    // Raw string send — no JSON.parse/stringify round trip — so the response
    // is byte-identical to the committed file the CI drift gate compares.
    res.type('application/json').send(artifact);
  };
}
