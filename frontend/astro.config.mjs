// @ts-check
import { defineConfig } from 'astro/config';

// PUBLIC_API_URL is baked into the client bundle at build time
// (import.meta.env is statically replaced) — by the time the browser would
// see it missing, a broken build is already deployed. config.ts's fallback
// to http://localhost:3031/3032 exists only for local dev convenience.
// Checked against argv (not NODE_ENV — `astro check` also runs with
// NODE_ENV=production internally, which would false-positive here) so only
// the actual `astro build` subcommand is guarded.
if (process.argv.includes('build') && !process.env.PUBLIC_API_URL) {
  throw new Error(
    'PUBLIC_API_URL must be set for a production build — without it, ' +
      'frontend/src/config.ts silently falls back to a localhost URL.',
  );
}

// https://astro.build/config
export default defineConfig({});
