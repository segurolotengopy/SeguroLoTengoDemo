# Decisión: migrar la conexión Amplify ↔ GitHub de OAuth a la Amplify GitHub App

**Fecha:** 10 de agosto de 2026
**App:** `slt-demo-segurolotengo` (`d3su6j17axjeyl`, us-east-1) → repo `segurolotengopy/SeguroLoTengoDemo`
**Referencia:** [Setting up Amplify access to GitHub repositories](https://docs.aws.amazon.com/amplify/latest/userguide/setting-up-GitHub-access.html#migrating-to-github-app-auth)

## Situación actual

La app se conectó al repo por API (`aws amplify update-app --access-token ...`) usando el
**token de sesión de la CLI de `gh`** de la cuenta `segurolotengopy` — no un token dedicado.
Eso dejó un riesgo operativo documentado: si esa sesión de `gh` se cierra o el token se
revoca, Amplify pierde el acceso al repo y los builds automáticos dejan de dispararse.
El plan anterior era reemplazarlo por un PAT dedicado con scope `repo`.

## Qué propone AWS

Migrar de OAuth a la **Amplify GitHub App** (`aws-amplify-us-east-1`). El flujo es 100 %
en consola: botón «Iniciar la migración» → autorizar la App en GitHub → elegir en qué
repos se instala → «Complete installation», que **borra el webhook OAuth viejo y crea
uno nuevo** bajo la App. AWS lo recomienda explícitamente también para apps conectadas
por CLI/CloudFormation/SDK, que es nuestro caso; la migración en sí no se puede hacer
por API, solo por consola.

## Análisis

**La migración es mejor que el plan del PAT, y lo reemplaza:**

1. **Elimina el riesgo operativo de raíz.** La conexión deja de depender de un token de
   usuario (el de `gh` hoy, un PAT mañana — que también expira o se revoca). La App tiene
   su propia identidad e instalación; cerrar sesión de `gh` deja de afectar los builds.
2. **Menos permisos.** El token OAuth actual tiene scope `repo` completo (lectura y
   escritura de todos los repos de la cuenta). La App es de **solo lectura** y se puede
   instalar **únicamente sobre `SeguroLoTengoDemo`** («Only select repositories») —
   alineado con el criterio de mínimo privilegio del proyecto (mismo espíritu que
   `aab1-demo-deployer` y `aab1-demo-qa`).
3. **Sin PAT que custodiar ni rotar.** El PAT con `admin:repo_hook` que menciona la doc
   solo hace falta para crear apps *nuevas* por CLI/CloudFormation, no para esta migración
   ni para el funcionamiento posterior.

**Riesgos y mitigación:**

- El paso final borra el webhook viejo y crea el nuevo. Ventana de corte mínima; si un
  push cae justo en ese instante, el build se dispara a mano con
  `aws amplify start-job --app-id d3su6j17axjeyl --branch-name main --job-type RELEASE`.
- Hay que estar logueado en GitHub como **`segurolotengopy`** (no la cuenta personal
  `AndresAlberdi`) al autorizar la App, y elegir esa cuenta como destino de instalación.
- CI/CD sigue funcionando con OAuth mientras tanto: no hay urgencia técnica, pero cada
  día que pasa el riesgo del token de `gh` sigue vivo.

## Decisión

Migrar a la Amplify GitHub App. Pasos:

1. En la consola de Amplify (cuenta `120005938663`, us-east-1), app
   `slt-demo-segurolotengo` → «Iniciar la migración».
2. Autorizar AWS Amplify en GitHub **con la sesión de `segurolotengopy`**.
3. Instalación: «Only select repositories» → `SeguroLoTengoDemo` únicamente.
4. «Complete installation».
5. Verificar: push trivial a `main` (o `start-job`) y confirmar que el build se dispara.
6. Opcional, después de verificar: revocar el token OAuth viejo en GitHub
   (Settings → Applications → Authorized OAuth Apps → AWS Amplify) para que no quede
   un acceso con scope `repo` colgando.

La migración la ejecuta una persona en consola (requiere la sesión de GitHub de
`segurolotengopy` y permisos de consola de AWS); no es automatizable por API.

**Ejecutada el 10 de agosto de 2026.** Pendientes: verificar que el próximo push a
`main` dispara el build por la App (el merge del PR de `feat/p8-p9-pantalla-b` sirve
de verificación), y revocar el OAuth viejo de AWS Amplify en GitHub.

## Nota posterior

Con la App instalada queda disponible **Web previews** (deploy de cada PR a una URL
propia). No se activa en esta decisión — deployar automáticamente cada PR de un repo
con documentación de terceros y flujo transaccional merece su propia evaluación.
