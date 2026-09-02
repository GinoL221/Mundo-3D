// Moved verbatim from `config.ts` (design.md D6, task 3.2). `config.ts`
// re-exports this so every existing `../../../config` import specifier
// across the codebase keeps working unchanged.
export const API_URL =
  import.meta.env.PUBLIC_API_URL ||
  (typeof window !== 'undefined' && window.location.port === '4322'
    ? 'http://localhost:3032'
    : 'http://localhost:3031');
