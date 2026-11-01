# Demo sandbox — disposable MySQL isolation verification

Worktree: `Mundo-3D-worktrees/demo-sandbox-stage1`; branch: `feat/demo-sandbox-stage1`.
Scope: authorized disposable integration only. Existing changes are preserved; commits and delivery are not authorized.

## Specs

### S1 — Exact approved disposable environment and lifecycle

User confirmation: "si autorizo" to: "¿Autorizás **crear y arrancar ese contenedor, preparar esos esquemas y cuentas, ejecutar las pruebas acotadas y eliminar únicamente ese contenedor y sus datos al terminar**? No se tocarán servicios existentes."
Approved resources: `m3d-sandbox-isolation-01a10377`, `127.0.0.1:33316`, schemas `m3d_sandbox_verify_a`, `m3d_sandbox_verify_b`, `m3d_sandbox_verify_control`, accounts `m3d_verify_a`, `m3d_verify_b`, cached `mysql@sha256:7dcddc01f13bab2f15cde676d44d01f61fc9f99fe7785e86196dfc07d358ae2b`, ephemeral data without existing host mounts or shared volumes.

### S2 — Evidence boundary

Accepted proposal: "Usaremos credenciales temporales nuevas, sin leer `.env`. Las pruebas comprobarán separación de datos, denegación de acceso cruzado y rollback real. **Reset, TLS y auth ligada a leases quedan fuera de este corte.**"

## Tasks

- T1 [done] S1–S2 — Add explicit, fail-closed MySQL integration and bounded verification documentation; route: parent inline; commit: not authorized.
- T2 [done] S1–S2 — Run focused integration in the owned container, ordinary local checks, and verify owned-resource cleanup; route: parent inline; commit: not authorized.
- T3 [done] S1–S2 — Independent verification and record evidence/remaining limits; route: parent exact authorized repeat, then limited follow-up with the existing verifier; commit: not authorized.

## Log

L1 — User: "si autorizo". Immediate preceding proposal:
"Inspección terminada, sin modificar servicios. Docker funciona y MySQL 8.0 está en caché, con el mismo digest que CI.

Propongo este entorno exclusivo:

| Recurso              | Destino                                                                      |
| -------------------- | ---------------------------------------------------------------------------- |
| Contenedor nuevo     | `m3d-sandbox-isolation-01a10377`                                             |
| Conexión             | `127.0.0.1:33316` — actualmente libre                                        |
| Esquemas desechables | `m3d_sandbox_verify_a`, `m3d_sandbox_verify_b`, `m3d_sandbox_verify_control` |
| Cuentas restringidas | `m3d_verify_a`, `m3d_verify_b`                                               |
| Datos                | Efímeros, sin montar carpetas ni volúmenes existentes                        |

Usaremos credenciales temporales nuevas, sin leer `.env`. Las pruebas comprobarán separación de datos, denegación de acceso cruzado y rollback real. **Reset, TLS y auth ligada a leases quedan fuera de este corte.**

¿Autorizás **crear y arrancar ese contenedor, preparar esos esquemas y cuentas, ejecutar las pruebas acotadas y eliminar únicamente ese contenedor y sus datos al terminar**? No se tocarán servicios existentes."

L2 — Classification: external lifecycle and evidence cannot be resumed from the source diff alone, so tracked separately. Forecast about 250–350 authored lines, single local verification unit, no delivery. No meaningful production RED: this adds real-DB verification for already implemented behavior rather than changing production logic. Missing/mismatched explicit configuration must fail before network/DDL; never skip. No forced production regression will be introduced.
L3 — Explorer mvpflv6b-2w-8e5x mapped the scoped composition/UoW and warned against the global `testDb` helper (`mundo_3d_test`/dotenv). Provision only selected existing model tables with a separate setup connection; restricted slot accounts receive only DML on their own exact schemas. No reset adapter exists, so reset is excluded. Safety identity checks precede DDL, and lifecycle cleanup is bound to the new container ID, not other names or volumes.
L4 — T1: added a dedicated `jest.sandbox.config.js` / `test:sandbox:mysql` command and `DemoSandboxProductRepositories.mysql.ts` so normal fast/real-DB selection remains unchanged. CLI discovery confirmed 164 fast files, 11 ordinary integration files, 1 opt-in sandbox file. TypeScript, directed ESLint, Prettier and diff-check passed. Probe job-216 deliberately supplied an invalid authorization marker: exit 1 with `Explicit disposable sandbox configuration required: M3D_SANDBOX_TEST_AUTHORIZATION` before construction/network/DDL. This is a fail-closed probe, not a production RED. Real MySQL execution remains to be observed.
L5 — First real execution job-217: exit 1; all 3 cases failed in beforeAll at the test's identity SELECT. The alias `database` is a reserved MySQL word; changed only that test query to `current_database`/`current_account`, retaining exact account/schema assertions. T1 was reopened for this correction; TypeScript, directed ESLint, Prettier and diff-check passed after the fix. Do not claim isolation from this failed execution. Container `b6a7909cc47e22dde526ae675363be835cf6607faec24bae4f8c69ab4099b2d5` was removed; port 33316 released; prior running-container and volume inventories unchanged. Full fast backend job-218 passed 164 suites/1209 cases and architecture check exited 0. Next run must confirm the SQL diagnosis and the real assertions on a fresh owned instance.
L6 — Corrected execution job-219 exited 0: 3/3 real MySQL tests passed. The old identity query was separately reproduced as ERROR 1064 / exit 1, confirming the reserved-word diagnosis. Owned container `53dc14028160a0a24062e6f3d1e9db98afb10556fcda3a6167262b724e596616` used the pinned image, loopback-only binding and tmpfs with no host mounts; it was removed, port 33316 released, and pre-existing running-container/volume inventories remained identical. Log: `/tmp/gentle-jobs-8FoAv8/job-219.log`. LSP probes on two changed source paths were inconclusive, not clean proof. An inherited ts-jest isolatedModules deprecation remains a warning; no config migration performed. Native assess returned unassessable due accumulated untracked paths; its conservative own-checks plus independent-verifier plan applies. No native START or review of the accumulated sandbox candidate was attempted. Reset/TLS/lease auth/other repositories/full migrations remain outside this evidence.
L7 — Independent verifier mvpg8ydq-2x-7wst: S2 PASS; S1 PARTIALLY VERIFIED because the stdout logs do not print actual container name/image digest. It freshly confirmed recorded IDs/name absent and port 33316 free, repeated all three suite-discovery checks (164/11/1) and the invalid-authorization probe (expected exit 1 before network). It did not independently rerun MySQL. No observed resource violation, and no code/assertion defect found. The original parent invocation supplied and checked the pinned image/name, but this is not being substituted for the verifier's requested independent runtime trace. A single bounded read of Docker create/destroy events for the successful ID returned no historical events; job inventory retains status/log paths only. T3 is blocked for human decision on accepting the evidence limitation or a separately approved single repeat with printed runtime name/image/ID. No resources were recreated, no evidence was fabricated or appended to the old runtime logs, and no native review was started.
L8 — User: "retoma, se corto por el limite de codex". Reconciled the feature file and memory without rerunning tests/resources. Parent asked: "Recomiendo **una única ejecución adicional**, con el mismo alcance autorizado, registrando explícitamente nombre, imagen e ID y verificando nuevamente la limpieza. ¿Autorizás esa repetición acotada?" User: "si". This authorizes one new execution with actual Docker identity/name/image metadata printed and asserted before tests; it does not expand resources/specs or authorize further repetitions.
L9 — Authorized repeat job-220 exited 0. Actual Docker inspect metadata printed and asserted: name `/m3d-sandbox-isolation-01a10377`, ID `114d229a0c9f3f418390b9d7769228b4a23c0428fe0ab3693400346805c20a98`, image ID `sha256:7dcddc01f13bab2f15cde676d44d01f61fc9f99fe7785e86196dfc07d358ae2b`, reference `mysql@sha256:7dcddc01f13bab2f15cde676d44d01f61fc9f99fe7785e86196dfc07d358ae2b`, expected ownership label, sole loopback33316 binding, tmpfs and no mounts. Identity assertions PASS; 3/3 MySQL cases PASS; JEST_EXIT=0. Cleanup confirmed that exact ID removed,33316 released and previous running-container/volume inventories unchanged. Log `/tmp/gentle-jobs-8FoAv8/job-220.log` is new evidence, not an alteration of earlier logs. No production/test logic edits or unrelated suites rerun. Existing verifier follow-up is limited to the original missing name/image evidence.
L10 — Limited follow-up mvpoqdn0-2y-j3yv (continuation of mvpg8ydq-2x-7wst) read L8-L9 and the whole job-220 log; original S1 evidence blocker CLOSED, S1 PASS on reviewed recorded evidence, previous S2 PASS remains applicable. No independent MySQL re-execution or new runtime operations by verifier. T3 complete. All T1-T3 outcomes observed; no commits authorized/made. The optional three-case sandbox suite remains separate from the previously passed 164-suite/1209-case backend run. Remaining excluded proof: reset, TLS, lease-bound auth/routing, other repositories and full migration chain. Native assess remains unavailable for accumulated untracked scope; no review was invented. LSP inconclusive results and inherited ts-jest warning remain reported limitations, not silent passes.
