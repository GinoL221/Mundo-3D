# Mundo-3D — Frontend

Astro frontend del monorepo Mundo-3D. La documentación completa (setup, comandos, arquitectura, variables de entorno) vive en el [README de la raíz](../README.md) — este archivo es solo un puntero para quien entra directo a `frontend/`.

## Comandos rápidos

Ejecutados desde `frontend/`:

```bash
pnpm dev             # Astro dev server, puerto 4321
pnpm build           # Build de producción (requiere PUBLIC_API_URL)
pnpm check           # astro check (TypeScript/Astro)
pnpm lint            # ESLint --max-warnings 0 (.ts, .astro, tools/**/*.js y *.config.{js,mjs}; @typescript-eslint/no-deprecated: "error" en **/*.ts)
pnpm test            # Vitest
pnpm quality:check   # prohíbe console.log en fuentes de producción bajo src/ (.astro, .ts, .tsx; excluye *.test.ts y .css)
```

Ver la sección "Comandos" del README de la raíz para el resto del monorepo (backend, E2E, migraciones).
