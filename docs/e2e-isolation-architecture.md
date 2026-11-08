# Arquitectura de Aislamiento por Ejecución para Pruebas E2E (MySQL y Mailpit)

Este documento detalla el diseño, modelo de amenazas, garantías y límites operativos de la infraestructura de aislamiento para las pruebas de integración End-to-End (E2E) con Playwright en Mundo-3D.

---

## 1. Motivación y Problema

Las pruebas E2E en Playwright requieren interactuar con servicios reales (MySQL y Mailpit). Históricamente, las pruebas locales y de CI dependían de puertos fijos (`3306` para MySQL, `8025/1025` para Mailpit) y bases de datos con nombres compartidos (`mundo_3d_test`), conllevando tres riesgos severos:
1. **Contaminación accidental:** Mutar o recrear (`sync({ force: true })`) la base de datos de desarrollo (`mundo_3d_dev`) o de otro proyecto si el puerto por defecto estaba ocupado.
2. **Carreras de concurrencia:** Dos ejecuciones simultáneas de Playwright (locales o en workers) colisionaban sobre el mismo puerto y estado de base de datos.
3. **Borrado masivo inseguro:** Comandos como `clearMailpit()` ejecutaban `DELETE /api/v1/messages` de manera global sin verificar si el endpoint pertenecía exclusivamente a la corrida activa.

---

## 2. Modelo de Amenazas y Límites de Seguridad

### Dentro del Alcance (Protección Garantizada)
- **Errores accidentales de configuración:** Prevenir que `test-prepare` o los tests E2E apunten a instancias compartidas o preexistentes.
- **Concurrencia local:** Múltiples corridas E2E pueden coexistir en la misma máquina sin colisionar en puertos ni en almacenamiento.
- **Fail-closed ante ambigüedad:** Si un recurso no puede ser positivamente identificado como perteneciente a la corrida, se prohíbe su uso y su eliminación automática.
- **Preservación de recursos ajenos:** Nunca se ejecutan purgas globales (`docker prune`, `docker volume prune`).

### Fuera del Alcance (Límite Operativo Explícito)
- **Actor local malicioso:** Se asume confianza en el host local y en el daemon de Docker (`unix:///var/run/docker.sock`). Quien posee acceso directo al socket de Docker tiene privilegios equivalentes a root y puede manipular o inspeccionar contenedores fuera del control de la aplicación.
- **No atomicidad de inspección/borrado frente a terceros:** Entre la inspección de un recurso y su eliminación existe una ventana no atómica que no resiste interferencia maliciosa intencional de otro proceso con permisos en el daemon.

---

## 3. Componentes de la Arquitectura

La solución se estructura en capas desacopladas con responsabilidades estrictas:

```
┌─────────────────────────────────────────────────────────────┐
│                 run-e2e-isolated.cjs                        │
│                 (Punto de Entrada CLI)                      │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 e2e-run-supervisor.cjs                      │
│                 (Supervisor de Ciclo de Vida)               │
│  - Genera runId efímero (32 hex)                            │
│  - Asigna puerto loopback libre dinámico                    │
│  - Entrega entorno aislado inmutable (sin mutar process.env)│
│  - Garantiza teardown fail-safe (try / finally)             │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
               ▼                              ▼
┌──────────────────────────────┐ ┌────────────────────────────┐
│   refresh-mysql-*.cjs        │ │  refresh-mailpit-*.cjs     │
│   (Contratos y Parsers)      │ │  (Contratos y Guards)      │
│ - creation-evidence: valida  │ │ - endpoint: loopback estric│
│   ID hex + volumen anónimo   │ │   sin credenciales ni paths│
│ - internal-uuid: parsea      │ │ - sanitizeOperation: lista │
│   SELECT @@server_uuid       │ │   blanca; prohíbe DELETE   │
│ - endpoint: valida TCP match │ │   sin verifiedInstance     │
└──────────────┬───────────────┘ └────────────┬───────────────┘
               │                              │
               ▼                              ▼
┌──────────────────────────────┐ ┌────────────────────────────┐
│   test-prepare-guard.cjs     │ │  mailpit-fixture-guard.cjs │
│ (Compuerta en test-prepare)  │ │ (Compuerta en fixtures E2E)│
└──────────────────────────────┘ └────────────────────────────┘
```

---

## 4. Ciclo de Vida y Garantías de Aislamiento

### A. Ciclo de Vida de MySQL Descartable
1. **Creación con volumen anónimo:** El contenedor se crea con `--mount type=volume,dst=/var/lib/mysql` sin nombrar el volumen. El evaluador `reconcileCreationEvidence` verifica que el ID del contenedor coincida exactamente y que no existan bind mounts ni montajes adicionales.
2. **Procedencia estricta del UUID:** Se ejecuta `SELECT @@server_uuid;` dentro del contenedor vía `docker exec`. El parser `parseInternalUuid` valida que la salida corresponda a un UUID canónico y rechaza cualquier anomalía o contenido en `stderr`.
3. **Fijación de conexión (TCP Pinning):** Al conectarse al puerto efímero mediante `mysql2`, `verifyEndpoint` comprueba que el servidor responda con el mismo UUID obtenido internamente.
4. **Compuerta de preparación (`test-prepare`):** `assertTestPrepareAuthorized` prohíbe `sequelize.sync({ force: true })` a menos que `M3D_E2E_RUN_ID` y `M3D_E2E_EXPECTED_SERVER_UUID` coincidan con la base observada.
5. **Teardown Garantizado:** El supervisor ejecuta `docker stop` y `docker rm -v` sobre el ID de 64 caracteres hex confirmado, eliminando el contenedor y su volumen anónimo sin dejar residuos.

### B. Ciclo de Vida de Mailpit
1. **Validación de URL Loopback:** Se rechazan URLs con credenciales, rutas adicionales o destinos que no sean estrictamente `127.0.0.1` o `localhost`.
2. **Sin llamadas de red ambientales:** El validador exige inyección explícita del transportador de red en pruebas para evitar llamadas reales accidentales.
3. **Lista blanca de operaciones:** Solo se permiten operaciones catalogadas (`GET_MESSAGES`, `GET_CHAOS`, `SET_CHAOS`, `DELETE_ALL_MESSAGES`).
4. **Compuerta contra borrado masivo:** `DELETE_ALL_MESSAGES` falla cerrado a menos que el cliente acredite un `runScope` con `verifiedInstance: true` y un `runId` válido.

---

## 5. Modo de Uso

Para ejecutar las pruebas E2E dentro del entorno supervisado y aislado:

```bash
# Ejecutar la suite completa E2E en contenedor descartable
node backend/scripts/run-e2e-isolated.cjs

# O pasando argumentos específicos de Playwright
node backend/scripts/run-e2e-isolated.cjs pnpm --filter e2e exec playwright test tests/auth.spec.ts
```

El script se encarga automáticamente de:
- Buscar un puerto libre en loopback.
- Levantar el contenedor descartable.
- Ejecutar `globalSetup` con los guards activos.
- Correr Playwright.
- Limpiar el contenedor y su volumen al finalizar.
