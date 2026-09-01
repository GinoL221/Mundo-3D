import fs from 'fs';
import type { Request, Response } from 'express';
import { OPENAPI_ARTIFACT_PATH, loadOpenApiArtifact, createOpenApiRouteHandler } from '../openapiArtifact';

function stubRes() {
  const res: Partial<Response> & { status: jest.Mock; type: jest.Mock; send: jest.Mock; json: jest.Mock } =
    {} as never;
  res.status = jest.fn().mockReturnValue(res);
  res.type = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response & { status: jest.Mock; type: jest.Mock; send: jest.Mock; json: jest.Mock };
}

describe('loadOpenApiArtifact', () => {
  it('returns null for a missing/unreadable path without throwing', () => {
    expect(() => loadOpenApiArtifact('/nonexistent/path/openapi.json')).not.toThrow();
    expect(loadOpenApiArtifact('/nonexistent/path/openapi.json')).toBeNull();
  });

  it('returns the exact committed file contents for OPENAPI_ARTIFACT_PATH', () => {
    const expected = fs.readFileSync(OPENAPI_ARTIFACT_PATH, 'utf-8');
    expect(loadOpenApiArtifact(OPENAPI_ARTIFACT_PATH)).toBe(expected);
  });
});

describe('createOpenApiRouteHandler', () => {
  it('responds 404 with a JSON error body when the artifact is null', () => {
    const handler = createOpenApiRouteHandler(null);
    const res = stubRes();

    handler({} as Request, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: expect.any(String) as unknown });
  });

  it('responds 200 with Content-Type application/json and the exact artifact bytes (no JSON round trip)', () => {
    // Irregular whitespace that JSON.parse -> JSON.stringify would normalize away.
    // Byte-equality here proves the handler never round-trips the artifact.
    const artifact = '{\n  "openapi":   "3.0.0"\n}';
    const handler = createOpenApiRouteHandler(artifact);
    const res = stubRes();

    handler({} as Request, res, jest.fn());

    expect(res.type).toHaveBeenCalledWith('application/json');
    expect(res.send).toHaveBeenCalledWith(artifact);
  });

  it('uses the module-level default artifact when none is passed', () => {
    const committedArtifact = fs.readFileSync(OPENAPI_ARTIFACT_PATH, 'utf-8');
    const handler = createOpenApiRouteHandler();
    const res = stubRes();

    handler({} as Request, res, jest.fn());

    expect(res.send).toHaveBeenCalledWith(committedArtifact);
  });
});
