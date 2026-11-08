# Aislamiento por ejecución de E2E

## Estado y alcance

La remediación conecta las validaciones a las rutas reales de preparación MySQL y fixtures Mailpit. El 2026-11-08 se ejecutó una validación real acotada con Docker: `tests/header.spec.ts` pasó 2/2 con MySQL y Mailpit propios; una cancelación por SIGINT salió con código 130 sin contenedores etiquetados ni procesos de la aplicación sobrevivientes; y una conexión MySQL real aceptó el UUID correcto y rechazó uno incorrecto. Eso **no** acredita la suite completa, la concurrencia entre corridas, la cancelación en GitHub Actions ni la ausencia universal de residuos.

El contrato de integración MySQL (`pnpm test:integration`) sigue siendo independiente: utiliza la base descartable configurada por el operador. Esta corrección no convierte cualquier `NODE_ENV=test` en un entorno seguro ni modifica grants, despliegue o acceso público al sandbox.

## Uso

Requiere Docker disponible y permiso para crear los recursos descartables de la ejecución:

```sh
pnpm test:e2e
pnpm test:e2e --grep 'registration'
pnpm test:e2e:all
pnpm --filter e2e test:ui
pnpm --filter e2e test:debug
```

Los argumentos llegan a Playwright sin volver a invocar el script `test`. El runner usa una ruta absoluta del workspace y no depende del directorio desde el que se lo invoca.

La entrada manual existente se conserva:

```sh
node backend/scripts/run-e2e-isolated.cjs --playwright --project=chromium
node backend/scripts/run-e2e-isolated.cjs pnpm --filter e2e exec playwright test
node backend/scripts/run-e2e-isolated.cjs --help
```

`pnpm --filter backend db:test:prepare` es una operación interna destructiva: sin contexto supervisado válido, termina con salida 1, stdout vacío y `Error preparing test database: E2E database context rejected`. No completar variables a mano para saltar esa protección. Un Playwright directo con la configuración principal también requiere los endpoints del supervisor.

## Recursos y evidencia

1. El supervisor genera un run ID aleatorio de 32 hexadecimales y crea MySQL y Mailpit nuevos. No usa ni inicia los servicios compartidos de Compose.
2. Docker asigna puertos TCP dinámicos publicados solamente en `127.0.0.1`. Backend y frontend reciben puertos efímeros separados y nunca reutilizan servidores existentes. Si esos puertos de aplicación dejan de estar libres antes del arranque, la ejecución debe fallar; no hay reserva atómica entre asignación y uso.
3. El proveedor conserva el ID exacto devuelto por su propio `docker create`. Concilia una inspección independiente: nombre, run ID, tipo, imagen y mounts. Para MySQL exige un único volumen anónimo en `/var/lib/mysql`; para Mailpit, ningún mount.
4. Solo los registros creados y confirmados por esa instancia de proveedor habilitan su cleanup. Un booleano suministrado por el caller o un nombre coincidente no constituye autorización de eliminación.
5. Si la creación queda incierta, el error identifica el nombre candidato y se conserva para inspección humana. No se busca por prefijos para borrar ni se hace `prune`.

MySQL mantiene el digest ya fijado en el proyecto. Mailpit conserva `axllent/mailpit:v1.28.2`, la versión de Compose existente; esa etiqueta no es un digest inmutable y su descarga ocurre dentro del timeout de `docker create`.

MySQL no se declara listo solo porque el socket interno responda: durante el primer arranque existe un servidor temporal con UUID final y red deshabilitada. El proveedor exige además que el puerto TCP publicado en loopback acepte conexiones antes de habilitar la corrida.

## Conexiones MySQL

El UUID esperado se obtiene dentro del contenedor confirmado. `ensureDatabaseExists` compara el UUID observado en su conexión TCP antes de `CREATE DATABASE`, y cierra la conexión también ante rechazo o error de DDL.

El factory de Sequelize instala un hook `afterConnect` para cada conexión física E2E, incluidas la consulta de versión, las del pool y sus reemplazos. El hook compara el UUID antes de entregar la conexión al pool y destruye las discordantes. Sequelize puede ajustar opciones de sesión antes del hook; eso no demuestra ausencia absoluta de comandos anteriores a la validación.

`test-prepare` exige contexto antes de cargar modelos o ejecutar sync/seed. Los contextos parciales no hacen fallback al flujo de integración sin contexto. La validación de entorno y un UUID coincidente no prueban propiedad por sí solos: dependen de la procedencia establecida por el supervisor.

El runtime vive en `backend/src/database/e2e/`; los scripts históricos reexportan las mismas APIs. Así el build con `rootDir=src` incluye sus dependencias sin importar archivos de `backend/scripts` fuera de ese límite.

## Mailpit HTTP y SMTP

El supervisor entrega el ID de Mailpit y sus puertos HTTP/SMTP en el entorno de la corrida. El backend recibe el endpoint SMTP dinámico. Antes de cada operación del fixture, `createOwnedMailpitClient` consulta Docker y comprueba que ambos protocolos correspondan al mismo contenedor activo, con el nombre/run/imagen esperados.

Todas las lecturas, el borrado global de mensajes y los cambios/restauraciones de chaos usan ese cliente. No se admite `verifiedInstance: true` como sustituto de la inspección. Las rutas y métodos están limitados; los redirects HTTP se rechazan y las solicitudes tienen timeout. Los errores de restauración de chaos siguen fallando la prueba.

La respuesta `/info` sirve para comprobar readiness, no para demostrar identidad ni propiedad. La vinculación entre protocolos depende del mapeo del daemon confiable, no de la versión que declare Mailpit.

## Cancelación y limpieza

El runner utiliza un hijo asíncrono en un grupo propio. Ante SIGINT/SIGTERM envía **SIGINT** al grupo, la señal que el CLI de Playwright maneja para apagar sus webServers, y escala a SIGKILL tras una ventana de gracia. Espera el cierre del hijo y luego intenta limpiar cada recurso confirmado en orden inverso. Propaga el código de salida y los errores de trabajo y cleanup; un fallo de eliminación no se transforma en PASS.

Antes de detener y de eliminar se reinspeccionan los recursos y el volumen esperado. Tras `rm -v`, consultas exitosas de contenedores y volúmenes deben confirmar ausencia de esos IDs exactos. Si no se puede verificar propiedad, detención o ausencia, la ejecución falla y preserva evidencia para intervención humana; no amplía el alcance de eliminación.

**Límites:** SIGKILL, caída del host/daemon, procesos que se separen del grupo y errores del sistema pueden impedir cleanup. No hay garantía universal de cero residuos. Inspección y eliminación tampoco son una transacción atómica frente a otros actores con acceso al daemon.

## Modelo de confianza y pruebas

Se confía en el host, Docker y el entorno transmitido por el supervisor. No se protege contra un actor local malicioso con control del socket Docker o de las variables/procesos. No se afirman garantías de autorización por credenciales compartidas o por prefijos de nombres.

Los tests Node verifican contratos con drivers, procesos y Docker simulados, además del rechazo público de preparación. La configuración CI exige esos `.test.cjs` y el build backend sin emisión; conserva el job de integración separado, el retry único, el reporte JSON y los diagnósticos Playwright. Los checks textuales del workflow no sustituyen la ejecución real de Actions.

Antes del cierre operativo faltan las pruebas autorizadas contra recursos identificados que cubran la suite completa, concurrencia, reconexiones bajo carga, UI y debug, cancelación en CI y verificación de residuos tras esas corridas. Los resultados observados se registran en `odd/tasks/e2e-isolation-remediation.md`; no se infieren de mocks ni de un CI anterior.
