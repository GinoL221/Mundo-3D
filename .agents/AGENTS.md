# Project Rules: Gentleman-Book Guidelines for Mundo-3D

Este archivo define las reglas locales del proyecto basadas en el libro de Gentleman Programming y las decisiones de arquitectura consensuadas.

## TypeScript & Linting Standards

1. **Prohibición de `any` (Anti-Patrón `any`)**:
   - Queda terminantemente prohibido el uso explícito del tipo `any` en el código TypeScript de la aplicación.
   - Cualquier uso de `any` debe ser marcado como **error** por el linter.
   - En su lugar, declarar tipos específicos, interfaces completas, o usar `unknown` en conjunto con guardas de tipo (type guards) o variables temporales de refinamiento si los datos provienen del exterior.

2. **Variables no usadas**:
   - Toda variable declarada y no utilizada debe lanzar un **error** en el linter.
   - Excepción: Parámetros obligatorios por contrato o firma de API (como middlewares de Express) que no se utilicen deben ser prefijados con un guion bajo (ej. `_req`, `_next`).

3. **Análisis Estático Basado en Tipos (Type-Aware Linting)**:
   - Mantener habilitado el análisis profundo con acceso al proyecto de TypeScript (`tsconfig.json`) para prevenir promesas flotantes, chequeos redundantes o llamadas inválidas en tiempo de compilación.

4. **Separación de Responsabilidades (ESLint + Prettier)**:
   - ESLint se encarga exclusivamente de la calidad del código, tipos y lógica.
   - Prettier se encarga del formateo visual de forma independiente. No se deben mezclar reglas de espaciado o formato visual dentro de ESLint.
