# Mundo-3D — Frontend

Astro frontend del monorepo Mundo-3D. La documentación completa (setup, comandos, arquitectura, variables de entorno) vive en el [README de la raíz](../README.md) — este archivo es solo un puntero para quien entra directo a `frontend/`.

## Comandos rápidos

Ejecutados desde `frontend/`:

```bash
pnpm dev             # Astro dev server, puerto 4321
pnpm build           # Build de producción (requiere PUBLIC_API_URL)
pnpm check           # astro check (TypeScript/Astro)
pnpm test            # Vitest
pnpm quality:check   # console.log y límite de 250 líneas por archivo
```

Ver la sección "Comandos" del README de la raíz para el resto del monorepo (backend, E2E, migraciones).
