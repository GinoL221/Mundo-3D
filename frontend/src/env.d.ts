/// <reference types="astro/client" />

// Without this declaration `import.meta.env.PUBLIC_API_URL` is typed `any`,
// which silently spreads through config.ts into every service that builds a
// request URL. astro.config.mjs already fails a production build when the
// variable is missing, so it is typed as a required string here.
interface ImportMetaEnv {
  readonly PUBLIC_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
