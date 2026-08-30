# Bitácora de cambios

Registro cronológico de cada sesión de trabajo: **qué se cambió, qué decidió o
ejecutó Andres, con qué se verificó, y qué quedó abierto.**

## Para qué existe

El repositorio conserva el *resultado* del trabajo —el código, los documentos de
decisión, la matriz de cumplimiento— pero no el *caso*: por qué se tocó algo, qué
se probó antes de creerlo, qué se descartó y con qué prueba. Esa parte vivía en la
conversación de cada sesión y se perdía al cerrarla, así que la sesión siguiente
volvía a preguntar lo mismo o, peor, rehacía una decisión ya tomada.

Pedido explícito de Andres el 21-ago-2026, después de una sesión en la que dos
cosas ya decididas —la selfie por archivo y el sexo editable— se habían quedado
sin implementar justamente por eso.

## Cómo se escribe una entrada

Orden inverso: **lo más reciente arriba**. Cada entrada lleva las cinco secciones
de abajo, y ninguna es opcional:

| Sección | Qué va |
| :---- | :---- |
| **El caso** | Qué disparó la sesión. Sin esto, dentro de un mes el cambio parece arbitrario. |
| **Qué cambió** | Los cambios de código y documentación, con el porqué de cada uno. |
| **Qué hizo Andres** | Sus decisiones y lo que ejecutó él: consolas, comandos, verificaciones propias. Un cambio hecho "porque me lo pidieron" tiene que decir quién y cuándo. |
| **Verificaciones** | Resultados concretos, con números. `npm test` en verde no es un dato: `1120 tests` sí. |
| **Queda abierto** | Lo que espera una decisión, y de quién. Es la sección que la sesión siguiente lee primero. |

Dos reglas que hacen que esto sirva:

- **Los intermitentes se registran con su prueba.** "El test falla a veces" es
  ruido; "falla 1 de 2 también sobre el árbol limpio, verificado con `git stash`"
  evita que la próxima sesión gaste una hora buscando una regresión que no existe.
- **Lo que NO se hizo también se anota**, con el motivo. Media bitácora se vuelve
  inútil cuando registra solo los éxitos.

---

## 2026-08-29 (e) · Lote F1: el flujo v3 entra al dominio detrás del flag FLUJO_V3

**Rama:** `feat/f1-flujo-v3-dominio` · **Implementación (primer lote de código)**

### El caso

Con la Fase 1 documental cerrada, Andres pidió abrir la sesión de
`PASOS_FLUJO`. La restricción que dio forma al plan: el merge a main ES el
deploy, así que cambiar la lista a 3 rutas sin páginas rompería producción.
Andres eligió la estrategia de **flag de entorno `FLUJO_V3`** (mismo patrón
que DEMO_MODE y los INTEGRATION_*): lotes chicos con el flag apagado, un PR
final lo enciende.

### Qué cambió

- `src/domain/flujo-vigente.ts` (nuevo): `flujoV3Activo()`, único lector del
  flag. La versión del flujo es propiedad del despliegue, así que se resuelve
  a import-time y ningún consumidor cambia de firma.
- `rutas-flujo.ts`: `PASOS_FLUJO_V2/V3` (3 pasos: /inscripcion, /seguro,
  /pago-y-firma), `PANTALLA_POR_ESTADO_V2/V3` (la v3 mapea estados
  intermedios a su página larga — el corazón del gating en cascada) y
  `REDIRECCIONES_RUTAS_VIEJAS_V2/V3` (la v3 redirige también los slugs
  semánticos v2).
- `expediente.ts`: `TRANSICIONES_V2/V3`. El orden nuevo (identidad primero,
  DI-2) recablea aristas entre los estados existentes — cero estados nuevos;
  el tramo desde DECLARACIONES_OK es idéntico al v2 (verificado por test).
  ASISTENCIA_IDENTIDAD sale de INICIADO; DERIVADO_MANUAL de PLAN_SELECCIONADO.
- Constantes por versión: `CANAL_WHATSAPP_P1.estadoRequerido`
  (IDENTIDAD_VERIFICADA en v3), `ESTADO_REQUERIDO_P5` (INICIADO),
  `ESTADO_REQUERIDO_P6` (PLAN_SELECCIONADO), `RUTA_TRAS_DECLARACIONES` y
  `RUTA_PAGO` derivadas de PANTALLA_POR_ESTADO, y `seleccionarPlan` en v3 ya
  no crea el expediente (nacerá con los T&C del inicio, DI-10/F5).
- Tests: los contratos v2 quedaron fijados por nombre (_V2), bloque nuevo de
  PANTALLA_POR_ESTADO_V3, y `flujo-v3.test.ts` con los invariantes del grafo
  (regla 6-bis, tramo D-08 idéntico, terminales intactos) y la selección por
  flag vía vi.stubEnv + import dinámico.

### Qué hizo Andres

- Eligió la estrategia del flag (contra rama larga y contra mega-PR).
- Aprobó el plan del lote F1 en plan mode.

### Verificaciones

- `npm run typecheck && npm run lint && npm test`: **86 archivos, 1171 tests
  en verde** (17 nuevos), con el flag apagado — cero cambio de comportamiento.
- `npm run build` en verde con el flag apagado.
- `grep FLUJO_V3` confinado a src/domain y tests: ningún componente de UI lo
  lee todavía.
- Desvío declarado respecto del plan: la corrida de la suite completa con
  `FLUJO_V3=true` se difirió a F6 — los tests históricos fijan comportamiento
  v2 y migrarlos ahora sería trabajo tirado; los contratos v3 quedan cubiertos
  por los tests por nombre (_V3), que no dependen del entorno.

### Queda abierto

- F2: página `/inscripcion` (paso 1) — convertir los `window.location.assign`
  de los componentes en callbacks `onCompletado` y montarlos como secciones.
- F3: `/seguro` · F4: `/pago-y-firma` (+ decisión de la rama de firma
  interna) · F5: inicio (T&C crea expediente, DI-10) + confirmación +
  revisión manual · F6: encendido del flag, migración de la suite y los E2E,
  barrido de expedientes v2 en curso del demo, retiro del v2.
- El spec `08-plan-tramite-en-curso` habrá que rediseñarlo en F3/F6: su
  escenario entero asume una pantalla por paso.

---

## 2026-08-29 (d) · Fase 1: ESPECIFICACION_PANTALLAS.md reescrita al flujo de 3 pasos

**Rama:** `docs/especificacion-pantallas-3-pasos` · **Especificación**

### El caso

Con las 11 DI decididas (PR #62 mergeado), Andres pidió arrancar la
reescritura de la especificación de pantallas contra el canvas importado y el
Bloque E.

### Qué cambió

- `docs/ESPECIFICACION_PANTALLAS.md` reescrita completa: 3 pasos visibles con
  gating en cascada (+ inicio, confirmación y revisión manual fuera del
  contador), textos literales del canvas, premios aprobados
  (319.000/522.500/726.000), aceptaciones agrupadas, mapa 5→8 de
  declaraciones con tabla explícita, y banner de transición: describe la
  configuración OBJETIVO; el código en main sigue en 8 pasos hasta que los
  lotes cierren, y el orden vigente sigue viviendo en PASOS_FLUJO.
- Verificaciones DI-3 y DI-7 hechas contra `Solicitud.pdf` (pdftotext): la
  declaración médica son 3 preguntas + 4 finales + PEP en FIPF — el mapa 5→8
  cierra sin huecos; el beneficiario del formulario lleva nombre, parentesco
  y domicilio — los 3 campos extra del canvas (cédula, f. nac., celular del
  beneficiario) NO se piden, por DI-7 mandan los campos de la Solicitud.
- El expandible «¿Qué es el FIPF?» quedó redactado sobre el formulario real
  (DI-1); las referencias regulatorias del canvas quedaron rotuladas como
  marcadores provisionales (DI-4).

### Qué hizo Andres

- Mergeó el #62 y pidió arrancar la reescritura («arranquemos»).

### Verificaciones

- `npm run typecheck && npm run lint && npm test` sobre la rama (el test de
  higiene de citas también vigila docs/).

### Queda abierto

- Primer PR de implementación: `PASOS_FLUJO` con pasos visibles (3) y las
  rutas nuevas (`/inscripcion`, `/seguro`, `/pago-y-firma`, provisionales
  hasta ese PR), sin aplanar la máquina de estados (DI-2).
- Después, un paso por sesión (cada paso nuevo es una página larga: paso 1,
  paso 2, paso 3, inicio+confirmación+revisión).
- La rama de firma interna (`claude/code100-api-integration-1f2547`) se
  integra al implementar el paso 3.
- Los marcadores provisionales (DI-4) esperan el dato oficial de Alianza.

---

## 2026-08-29 (c) · Fase 1: las 11 DI resueltas en DECISIONES.md

**Rama:** `docs/decisiones-di-diseno-3-pasos` · **Ronda de decisiones**

### El caso

Con el PR #61 mergeado, Andres resolvió la ronda completa de divergencias de
la importación del diseño (DI-1…DI-11), dos por mensaje directo y cuatro por
preguntas estructuradas; las cinco restantes se derivaron de reglas ya
existentes.

### Qué cambió

- `docs/plan/DECISIONES.md`: **Bloque E** nuevo con las once DI decididas.
- `docs/plan/IMPORTACION_DISENO_3_PASOS.md` §6: marcado como ronda resuelta,
  apuntando al Bloque E como fuente de verdad.

### Qué hizo Andres

- Mergeó el #61 (pidió el merge explícitamente).
- **DI-1:** confirmó que FIPF es el Formulario de Identificación de Persona
  Física (Res. SEPRELAD 71/19); el texto del canvas es error de maqueta.
- **DI-4:** confirmó que carencias, resolución y código de producto del
  canvas son marcadores de la maqueta (parámetros provisionales, criterio D-04).
- **DI-3, DI-5, DI-8, DI-10:** eligió la opción recomendada en las cuatro
  (PDF conserva las 8 declaraciones con mapa 5→8; enlace de firma por ambos
  canales; casillas agrupadas como el canvas; T&C del inicio con evidencia).

### Verificaciones

- `npm run typecheck && npm run lint && npm test` (solo docs, igual corre la
  cadena por política).

### Queda abierto

- Reescribir `ESPECIFICACION_PANTALLAS.md` contra el documento de importación
  y el Bloque E — incluye documentar el mapa 5→8 y cotejar el beneficiario
  contra `Solicitud.pdf` (DI-7).
- Primer PR de implementación: `PASOS_FLUJO` con pasos visibles (3) sin
  aplanar la máquina de estados (DI-2).
- La rama de firma interna se integra al implementar el paso 3 (DI-5 ya la
  respalda).

---

## 2026-08-29 (b) · Fase 1: importación del diseño de 3 pasos desde Claude Design

**Rama:** `docs/importacion-diseno-3-pasos` · **Importación de diseño**

### El caso

Con la Fase 0 cerrada (PR #60 mergeado, ramas y worktrees consolidados),
Andres pidió arrancar la Fase 1 del cambio de configuración de pantallas. El
diseño ya estaba aprobado en Claude Design, así que no se re-maqueta: se
importa.

### Qué cambió

- `docs/plan/IMPORTACION_DISENO_3_PASOS.md`: transcripción fiel del canvas
  «Seguro lo tengo: Flujo de 3 pasos» (artifact ce0c8332, 27-ago) —
  estructura de 3 pasos + inicio/confirmación/revisión, textos por pantalla,
  planes y carencias, las 5 declaraciones nuevas, trazabilidad contra los 8
  pasos vigentes y **11 divergencias (DI-1…DI-11)** que necesitan decisión
  antes de reescribir `ESPECIFICACION_PANTALLAS.md`.

### Qué hizo Andres

- Mergeó #57, #55, #56, #59 y #60 (resuelto el conflicto de
  `textos-aclaraciones.ts` integrando el derecho de retracto al catálogo-función).
- Borró las ramas que exigían `-D`.
- Confirmó que el diseño aprobado es el canvas de Claude Design y que la
  Fase 1 lo importa en lugar de re-maquetar.

### Verificaciones

- La extracción del canvas se hizo del bundle publicado (template JSON de
  163 KB + datos del prototipo de 53 KB); los premios extraídos (319.000 /
  522.500 / 726.000) coinciden con la decisión aprobada del 20-ago.

### Queda abierto

- **Las 11 decisiones DI-1…DI-11** del documento — Andres. Las tres urgentes:
  DI-1 (qué significa FIPF: el canvas lo redefine como «Información Previa a
  la Firma» y contradice a la Res. SEPRELAD 71/19), DI-3 (mapa de 8→5
  declaraciones contra `Solicitud.pdf`) y DI-4 (carencias 180/30/1 y
  Res. 250/2026: ¿datos reales de Alianza o marcadores de la maqueta?).
- Reescritura de `ESPECIFICACION_PANTALLAS.md` contra el documento importado.
- Primer PR de implementación: `PASOS_FLUJO` con la noción de paso visible
  (3) sin aplanar la máquina de estados.
- La rama de firma interna se integra al implementar el paso 3.

---

## 2026-08-29 · Fase 0: consolidación del repo antes del cambio de configuración de pantallas

**Rama:** `claude/review-pending-prs-e227dd` · **Consolidación**

### El caso

Andres pidió un análisis completo del repo (ramas, worktrees, PRs, dependencias)
como antesala de un **cambio mayor: nueva configuración de pantallas**, cuyo
diseño ya está aprobado en Claude Design. El análisis encontró trabajo valioso
sin asegurar: esta rama con ~1.300 líneas sin commitear (incluida esta bitácora),
la rama de firma interna con 8 commits sin pushear, y el `main` local 10 commits
detrás de `origin/main`.

### Qué cambió

- Este commit asegura el trabajo de la sesión del 21-ago que había quedado
  suelto en el worktree: reencaminado del flujo, mock de Bancard fiel a los
  documentos del proveedor (EMVCo, `response_code` reales), OTP de firma en
  bloque propio, E2E `09-firma-reintento-codigo`, la bitácora y el `CLAUDE.md`
  actualizado con las decisiones del 20/21-ago.
- Se pusheó `claude/code100-api-integration-1f2547` (firma interna, 8 commits
  que estaban solo en local, a la espera del rediseño de pantallas).
- Se abrió PR #59 con `docs/DECISION_MIGRACION_GITHUB_APP.md`, que vivía sin
  trackear desde el 10-ago.
- Tags de archivo `archive/hardening-seguridad` y `archive/wip-l4-inversion-firma-pago`
  antes de proponer el borrado de esas ramas.

### Qué hizo Andres

- Aprobó ejecutar la Fase 0 completa (2026-08-29).
- Decidió que el diseño de la nueva configuración de pantallas ya está aprobado
  en Claude Design: la Fase 1 lo importa desde su Artifact, no re-maqueta.
- Quedan a su cargo (bloqueados para el agente por política): mergear #57, #55,
  #56 y #59, y borrar las ramas locales ya mergeadas.

### Verificaciones

- `npm run typecheck && npm run lint && npm test` sobre este árbol: **83 archivos,
  1131 tests, todos en verde** (4.9 s).
- CI de #57, #55 y #56: los 4 jobs en verde en los tres.
- `npm audit --omit=dev`: 0 vulnerabilidades.

### Queda abierto

- Mergear los PRs (#57, #59 y los dos de dependabot) — Andres.
- Esta rama necesita traerse `origin/main` (está 10 atrás) antes de su PR.
- El diff suelto de `ESPECIFICACION_PANTALLAS.md` en el worktree
  `elegant-murdock` describe el orden pago→firma anterior al Plan v2: decidir
  si se descarta — Andres.
- Ramas remotas sin PR: `claude/bancred-integration-docs-t1inpp` (4 commits,
  Pantalla B con respuestas de Bancard) y `claude/qr-interno-documentos-bf2u30`
  (token no adivinable en el QR) — rescatar o archivar.
- `chore/hardening-fase-2` tiene CodeQL sin mergear: abrirle PR o descartarlo.
- Fase 1 del cambio de pantallas: importar el diseño aprobado desde Claude
  Design y actualizar `REFORMULACION_PANTALLAS_MAQUETA.md` y
  `ESPECIFICACION_PANTALLAS.md`; el primer PR de implementación es el de
  `PASOS_FLUJO` en `src/domain/rutas-flujo.ts`.

---

## 2026-08-21 (f) · La batería se degrada corrida a corrida — medido, no diagnosticado

**Rama:** `claude/review-pending-prs-e227dd` · **Problema abierto**

### El hecho

La batería E2E completa fue empeorando de forma monótona a lo largo de la
sesión, con el mismo hardware y sin cambios en los escenarios que fallan:

| Corrida | Tiempo | Fallos |
| :---- | :---- | :---- |
| 1ª | 12 min | 1 |
| 2ª | 17 min | 4 |
| 3ª | 23 min | 3 |
| 4ª | **37 min** | **7** |

**Todos los fallos son timeouts limpios**, no errores de lógica: escenarios que
no tocan nada de lo que se cambió (salud incompatible, biometría rechazada, OTP
agotado) mueren por reloj igual que los demás.

### Lo que la medición descarta

- **No es el código de los escenarios.** Corridos **solos**, pasan y en su
  tiempo de siempre: el camino feliz tarda 2,3 min aislado, igual que antes de
  toda esta tanda.
- **No son procesos huérfanos ni presión de recursos.** Con la batería
  terminada: cero procesos node vivos, carga 0,6, 20 GB de memoria libre.
- **No es un bucle de reintentos del paso 6.** Existía —el efecto que abre el
  acto se volvía a disparar solo si la apertura fallaba, un POST por vuelta— y
  se corrigió con un `ref`. Es un defecto real y valía arreglarlo, pero **la
  corrida siguiente fue la peor de todas**, así que no era la causa.
- **No es la latencia a AWS en reposo.** `describe-table` responde en ~1 s
  incluyendo el arranque del CLI.
- **No es que el repositorio se reconstruya caro.** `crearExpedienteRepository()`
  usa el cliente singleton de DynamoDB; no resuelve credenciales ni secretos por
  llamada.

### Lo que queda como hipótesis, sin probar

El servidor se degrada **a medida que la corrida avanza**, no entre corridas. El
cambio más sistémico de esta tanda es el chequeo previo `expedienteEnOtroPaso`,
que agregó **una lectura de DynamoDB en cada render de siete pantallas** y las
volvió dinámicas (leen cookies). Cientos de renders por batería.

**El experimento que lo decide** es barato de describir y caro de correr:
desactivar temporalmente esos chequeos y correr la batería completa. Si el
tiempo vuelve a la franja de los 12 minutos, es eso; si no, hay que seguir
buscando. No se corrió: son 20+ minutos y la decisión de gastarlos es de Andres.

### Por qué esto no invalida la tanda

Cada escenario, corrido solo, pasa. Lo que está en duda es la **batería como
instrumento**, no el producto: hoy no sirve para decir "todo verde" de una
pasada, y ese es exactamente el trabajo que se le pide antes de un despliegue.

---

## 2026-08-21 (e) · El reintento del código, verificado — y lo que costó verificarlo

**Rama:** `claude/review-pending-prs-e227dd`

### El caso

Andres eligió la **opción 1** para el bloque de canal del paso 6 —sacarlo de la
demostración y decir simplemente a dónde fue el código— **con una condición**:
*"verificando que efectivamente se pueda reintentar si hay error o se pueda
reintentar en demanda, en el demo"*.

Esa condición es la que valió la pena: verificarla destapó tres cosas que
estaban rotas y que nadie habría visto mirando la pantalla andar bien.

### Qué cambió

**El bloque de canal no se dibuja en demostración.** El acto se abre al cargar,
así que para cuando alguien miraba los controles el código ya había salido y
quedaban congelados desde el primer instante: ofrecían una decisión imposible.
Ahora se dice a dónde fue el código y listo. Poder cambiarlo exige descartar el
acto abierto, y eso el dominio no lo permite — queda anotado, no simulado.

**Los textos que narraban el enlace.** El indicador de tres pasos decía *"Recibí
el enlace / Abrí y firmá / Te confirmamos y volvés al portal"* — tres cosas que
en la demostración no pasan. Se agregó un juego propio
(`PASOS_PROGRESO_FIRMA_DEMO_P8`) en vez de cambiar el original, porque los dos
recorridos son ciertos, cada uno en su modo.

**Los mensajes de error no correspondían a los motivos reales.** De los ocho que
el servidor devuelve, el mapa acertaba **dos**: el resto caía en *"No pudimos
procesar el pedido"*. Un código mal tipeado —lo más normal del mundo— no decía ni
que estaba mal ni cuántos intentos quedaban. Ahora los motivos salen de
`ResultadoFirmaDemo` / `ResultadoAperturaDemo` y del propio Route Handler, y se
muestra `intentosRestantes`, que el servidor ya mandaba y la pantalla ignoraba.

**Escenario E2E nuevo (`09-firma-reintento-codigo`)** que fija los dos caminos
del reintento: se yerra el código, aparece el mensaje específico con los intentos
restantes y el trámite **sigue en pie**; se pide otro código, el proveedor emite
uno nuevo con el contador de intentos en cero; se firma con ese y el flujo sigue
al pago.

### Tres tropiezos propios, y qué enseñó cada uno

Ninguno era un bug del producto; los tres eran del andamiaje, y los tres se
veían igual desde afuera: "el test falla".

1. **El presupuesto de tiempo, no el código.** El camino feliz empezó a fallar
   **después de llegar al paso 8**: completaba todo y el reloj lo mataba en la
   última pantalla. El recorrido incorporó dos esperas deliberadas del producto
   —el contador de 5 s del pago y el cierre del paquete documental— y 180 s
   dejaron de alcanzar. Global a 300 s.
2. **Esperar el título en vez del contenido.** El ayudante daba por abierto el
   acto al ver el encabezado *"Código para firmar"*, que se dibuja apenas hay
   acto **mientras la emisión sigue en vuelo**. Leía el panel en ese hueco y
   encontraba `null`, con el mensaje "el panel no tiene código", que es cierto y
   desorienta. Ahora espera el texto que solo existe con el código ya emitido.
3. **`getByRole("alert")` no es unívoco en Next.** Devuelve también el
   `__next-route-announcer__`, invisible, y el modo estricto de Playwright se
   niega —con razón— a elegir. Se busca por texto.

### Verificaciones

| Qué | Resultado |
| :---- | :---- |
| `npm run typecheck` · `npm run lint` | Limpios |
| `npm test` | **1131 tests**, en verde |
| `e2e/01-camino-feliz` | Pasa (2,1 min) |
| `e2e/09-firma-reintento-codigo` | Pasa (1,9 min) — el reintento queda probado |

### Queda abierto

| Tema | Nota |
| :---- | :---- |
| Poder **cambiar de canal** en el paso 6 | Exige descartar un acto abierto, que hoy el dominio no permite. Es la opción 3 de las tres que se plantearon; quedó para el rediseño |
| Batería completa | Lanzada al cierre de esta entrada; en la corrida anterior habían fallado 4 escenarios que pasan aislados, sin causa diagnosticada |

---

## 2026-08-21 (d) · Las cinco observaciones, terminadas

**Rama:** `claude/review-pending-prs-e227dd` · **Estado: EN PAUSA, a pedido de Andres**

### El caso

Andres pidió terminar las cinco observaciones mientras arma el diseño nuevo.
Están las cinco. La batería E2E completa **no llegó a correr** sobre el
resultado final: se cortó al pausar.

### Qué cambió

**#2 · El paso 6 dejó de mandar un enlace y pasa a pedir el código.** Se fue el
botón *Enviar enlace seguro de firma* y se fue la ventana del firmador. El acto
se abre solo al cargar la pantalla y lo único que hay es el OTP de 6 dígitos
(`BloqueOtpFirma.tsx`), con *Firmar* y *Pedir un código nuevo*. El código sigue
emitiéndolo y validándolo el proveedor simulado con las reglas de siempre, y la
pantalla **nunca lo ve** (regla inviolable #2).

Efecto colateral buscado: **el problema del canal clavado desaparece por
construcción**, porque ya no queda un acto abierto esperando a que alguien
vuelva de otro lado. Se borraron `PanelFirmadorSimulado.tsx` y
`ModalFirmadorSimulado.tsx` (339 líneas), que quedaron sin un solo consumidor.

**#4 · El escenario 07, resuelto de raíz.** Miraba el 409 con la pantalla
abierta, y esa ventana la cierra el propio sondeo al reintentar el sellado. Ahora
va a `about:blank` antes de consultar —sin temporizadores corriendo— y usa
`page.request`, que lleva las cookies del contexto. **3 de 3, y bajó de 1,4 min a
34 s.**

**#5 · Links y mensajes.**

- Los dos enlaces del pie —*Derecho de retracto* y *Tus datos y cookies*—
  aparecen en todas las pantallas, incluidas las que tienen un formulario a
  medio llenar, y navegaban fuera. Ahora abren modal (`EnlaceAclaracion`). Se
  escribió el texto de retracto, con una sección de *qué no es* que separa el
  retracto de dejar vencer una solicitud sin pagar. Las páginas `/retracto` y
  `/privacidad` **se conservan** para quien llegue por su dirección.
- Los mensajes se mudaron junto a su acción. En el paso 7 hay tres acciones
  distintas —generar, *Pagado* y el sondeo— y el error vivía al final de la
  columna: ahora cada mensaje se dibuja junto al botón que lo produjo, con un
  `origenError` que decide cuál. En el paso 4 el error estaba a media pantalla
  del botón de validar; ahora va debajo.

### La corrección que importa: mi medición del 06 estaba viciada

Le había dicho a Andres que el escenario 06 fallaba **1 de cada 2 corridas
también sobre el árbol limpio**, y de ahí concluí que la causa era la lectura
eventual de DynamoDB. **Las dos mediciones usaban `--repeat-each`, y eso invalida
este escenario**: termina dejando el expediente en `VENCIDO`, que **bloquea la
cédula por la regla #11**, y el saneo de cédulas corre una vez por corrida, no
entre repeticiones. La segunda repetición estaba condenada por diseño.

Medido bien —tres corridas independientes— el 06 da **3 de 3 en verde**.

`ConsistentRead: true` se conserva igual, porque leer con consistencia eventual
en un flujo de escritura-y-lectura inmediata es incorrecto por su cuenta, pero
el comentario del código se corrigió: ya no se atribuye un mérito sin evidencia.

**La lección, para la próxima:** `--repeat-each` no sirve en los escenarios 2, 3
y 6, que terminan en estados que bloquean la cédula. Para muestrear esos, hay que
lanzar corridas independientes.

### Un fallo que solo apareció por el E2E

El autocompletado del OTP **no firmaba**. `onCompleto` de `CamposOtp` se dispara
en el mismo tick en que se escribe el sexto dígito, y `firmar()` leía el código
del estado, que todavía tenía cinco: la guarda de longitud cortaba **en
silencio**, sin mensaje. Con el botón sí andaba, que es lo que volvía confuso al
síntoma. El código pasa por parámetro.

### Verificaciones

| Qué | Resultado |
| :---- | :---- |
| `npm run typecheck` · `npm run lint` | Limpios |
| `npm test` | **1131 tests**, 83 archivos, en verde |
| `e2e/01-camino-feliz` | Pasa con el flujo nuevo (OTP en línea + botón *Pagado*) |
| `e2e/07-firma-atomica` ×3 independientes | 3 de 3 |
| `e2e/06-vencimiento-firma` ×3 independientes | 3 de 3 |
| Batería E2E completa | **No corrida** sobre el resultado final |

### Queda abierto

| Tema | Nota |
| :---- | :---- |
| Correr `npm run test:e2e` completo | Es lo único que falta para cerrar esta tanda |
| Armar el PR | Sin commitear: ~49 archivos tocados |
| La reformulación del UX | Andres la está armando; esta tanda es su punto de partida |

---

## 2026-08-21 (c) · Las cinco decisiones, respondidas — y detenido a mitad para reformular el UX

**Rama:** `claude/review-pending-prs-e227dd` · **Estado: EN PAUSA por decisión de Andres**

### El caso

Andres respondió las cinco decisiones que la entrada anterior dejaba abiertas.
Se alcanzaron a implementar dos y media antes de que pidiera parar: *"deja
pendiente todo esto aun, quiero reformular el UX"*.

**Lo que sigue es el punto de partida de esa reformulación.** Nada de lo
pendiente se empezó, así que no hay trabajo a medio hacer que haya que
desarmar.

### Las cinco respuestas de Andres, textuales

| # | Tema | Su respuesta |
| :---- | :---- | :---- |
| 1 | Aviso de vencimiento que ningún código manda | *"El texto es cierto, pero por fuera del sistema"* |
| 2 | El canal de firma queda clavado | *"Quita ese botón, solo pide el OTP, que debe llegar por Whatsapp o Mail, es solo para el demo"* |
| 3 | El mock de pago vive en memoria de la instancia | *"En lugar de eso, solamente que haya un contador de 5 segundos para el demo y activar el botón de «Pagado»"* |
| 4 | Los dos E2E intermitentes | *"Corrige de manera integral esa intermitencia"* |
| 5 | Los links de los formularios | *"Todos los links de los formularios deben abrir un modal con un mensaje paramétrico… en lugar de direccionar a cualquier lugar. Todos los mensajes deben aparecer cerca de la acción que los ha disparado no en otro lugar"* |

### Qué se alcanzó a hacer

**1 · Resuelto, sin código.** El aviso de vencimiento sí se da: lo hace el
equipo, por fuera del portal. El texto queda como está, y quedó anotado en
`textos-p7.ts` **por qué no hay que "arreglarlo"** de las dos maneras
tentadoras: sacar la frase ocultaría algo que de verdad ocurre, e implementar un
envío automático duplicaría el que ya se hace a mano.

**3 · Hecho.** El pago del demo ya no lo dispara un reloj:

- Contador de 5 segundos en el paso 7 y botón **Pagado**, que hace lo que en la
  realidad hace la persona en la app de su banco.
- `POST /api/p7/pagado`, extensión `route.demo.ts` — no se compila siquiera sin
  `DEMO_MODE`. **No transiciona el expediente**: eso lo sigue haciendo
  `confirmarPagoP7` desde el sondeo, con todas sus validaciones y emitiendo el
  certificado en la misma escritura (D-12).
- De paso resuelve el problema de fondo: `acreditarPagoMock` **reconstruye la
  operación desde el `Pago` persistido** si esta instancia de cómputo no la
  conoce, así que la acreditación deja de depender de qué instancia atendió cada
  pedido.

**4 · La causa de raíz, encontrada y corregida.** No era de los tests.

> **Ninguna lectura de DynamoDB pedía consistencia fuerte.** `GetItem` lee por
> omisión con consistencia eventual, y este producto es una secuencia de
> escrituras seguidas de lecturas inmediatas: una pantalla transiciona el
> expediente, navega, y la siguiente lo lee en el mismo segundo.

Eso es exactamente el escenario 06: al vencer el plazo, la pantalla de pago
confirmaba la transición a `VENCIDO` y llevaba a Pantalla B, que leía el
expediente todavía en `FIRMADO` y mostraba la pantalla con guiones. Falla ~1 de
cada 2 corridas — el ratio de una carrera, no de un test frágil. `obtenerPorId`
pasa a `ConsistentRead: true`. **Es un bug de producto, no de la suite**: le
podía pasar a cualquiera, no solo a Playwright.

El E2E del pago, además, dejó de depender de un temporizador: espera a que el
botón *Pagado* se habilite (con el auto-retry de Playwright, sin
`waitForTimeout`) y lo aprieta.

### Qué queda pendiente, para la reformulación del UX

| # | Qué falta | Nota para retomarlo |
| :---- | :---- | :---- |
| 2 | Quitar el botón de enviar enlace del paso 6 y dejar solo el OTP, que llega por WhatsApp o correo | Es el cambio que además elimina el problema del canal clavado, porque desaparece el acto que lo clavaba |
| 4 | El escenario **07** sigue intermitente | Su carrera es distinta a la del 06 y no la arregla `ConsistentRead`: el test comprueba que el cobro está inhabilitado (409) mientras faltan las firmas institucionales, pero esa ventana la cierra el propio sondeo de la pantalla, que reintenta cada 2 s. La salida limpia es detener el sondeo antes de consultar, no ampliar el plazo |
| 5 | Los links de los formularios abren modal con mensaje paramétrico; los mensajes van **junto a la acción que los disparó** | Ya existe `EnlaceAclaracion` (modal, sin navegar) y ya se usó para los tres documentos previos a la firma. La segunda mitad —mensajes cerca de la acción— es la que toca todas las pantallas |

### Verificaciones al momento de la pausa

| Qué | Resultado |
| :---- | :---- |
| `npm run typecheck` · `npm run lint` | Limpios |
| `npm test` | **1131 tests**, 83 archivos, en verde |
| `e2e/01-camino-feliz` con el botón *Pagado* | Pasa |

Todo sin commitear.

---

## 2026-08-21 (b) · Bancard: el mock pasa a hablar el idioma del proveedor

**Rama:** `claude/review-pending-prs-e227dd`

### El caso

Andres pidió que **los mensajes y el comportamiento de Bancard, incluido el
demo, salgan de los documentos de `docs/Integraciones/`**. El mock los inventaba:
una demostración que muestra un formato que no es el del producto enseña algo
falso, y el día que se escriba el adaptador oficial nadie se acuerda de que
aquello era de mentira.

### Qué cambió

- **El QR es EMVCo de verdad** (`src/adapters/mock/bancard-emvco.ts`). Antes era
  `bancard-qr://pago?ref=…&monto=…&moneda=PYG`, un esquema inventado que ningún
  lector reconoce. Ahora se arma con la estructura TLV del documento —etiquetas
  `00/01/02/52/53/54/58/59/60/62`— y cierra con **CRC-16/CCITT-FALSE** en la
  etiqueta `63`, calculado sobre todo lo anterior **incluido su propio
  encabezado `6304`**, que es la parte que se implementa mal si uno no la lee con
  cuidado. Es un QR **dinámico** (`01` = `12`): lleva el importe adentro.
- **`hook_alias`**, el identificador con el que Bancard QR notifica el pago por
  callback. No existía. Lleva prefijo `DEMO` para distinguirse de un alias real.
- **Los `response_code` del proveedor** (`CODIGOS_RESPUESTA_BANCARD` en el
  puerto): `00` aprobada, `05` tarjeta inhabilitada, `12` transacción inválida,
  `15` tarjeta inválida, `51` fondos insuficientes, con la descripción textual
  del documento. `EstadoConsultaPago` y `ErrorBancard` los transportan.
- **El rechazo forzado del panel usa `51`**, que es el del propio ejemplo del
  documento y el más frecuente en producción.
- **El mensaje de la pantalla se compone**: la razón la pone Bancard
  ("Bancard informó: Fondos insuficientes (código 51)"), el qué hacer lo pone el
  producto. Antes un solo texto genérico servía igual para fondos insuficientes
  que para una tarjeta inhabilitada, y esas dos cosas mandan a la persona a hacer
  cosas distintas.
- **El contrato compartido exige el formato** (`payment-provider.contract.ts`),
  no solo los tests del mock: el adaptador oficial tendrá que cumplirlo igual.
- **La nota en pantalla dejó de mentir**: decía que el payload era "análogo" al
  de Bancard; ahora dice que es EMVCo real y que el dibujo lo hace Bancard.

### Divergencia declarada, no unificada

**Los dos documentos de Bancard no coinciden en la moneda**: compra simple
declara `currency` como `PYG`, y el callback de QR trae `"currency":"GS"` en sus
ejemplos. Se conservan las dos (`MONEDA_BANCARD_VPOS` / `MONEDA_BANCARD_QR`):
son dos APIs distintas del mismo proveedor, y elegir una sola por prolijidad
sería inventar el contrato de la otra.

### Qué NO se hizo

- **La reversa automática a los 5 segundos.** El documento de QR es explícito:
  Bancard aguarda 5 s la respuesta del callback y, si no llega, *reversa la
  transacción*; y si el comercio no pudo responder, **debe llamar al endpoint
  `revert`**. Hoy no hay callback —el mock no lo emite— así que no hay nada que
  reversar. Cuando exista, esa regla es obligatoria y no opcional.
- **Los códigos que no están en el documento no se inventaron.** El vencimiento
  de un QR se marca con `12` (transacción inválida), que es el que corresponde a
  una transacción que nunca ocurrió, y no con un código propio.

### Verificaciones

| Qué | Resultado |
| :---- | :---- |
| `npm run typecheck` · `npm run lint` | Limpios |
| `npm test` | **1131 tests** (11 nuevos), 83 archivos, todo en verde |
| CRC-16 contra el vector público del algoritmo | `crc16Emvco("123456789")` = `29B1` |
| Parseo TLV de la cadena generada | Reconstruye la cadena entera sin desalinearse |

Un test que había escrito se descartó por inútil: buscaba "datos con forma de
cédula" en la salida y daba falso positivo contra el código de comercio. La
garantía de que no hay datos de la persona es **estructural** —la función solo
recibe importe y alias—, así que se reemplazó por uno que congela la lista de
etiquetas, que sí puede degradarse si alguien agrega una.

### Queda abierto

| Tema | De quién es la decisión |
| :---- | :---- |
| Datos reales del comercio (código, sucursal, rubro) para el EMVCo; hoy son de demostración y lo dicen | Bancard los provee al dar de alta la cuenta |
| Emitir el callback y honrar la reversa a los 5 s, con su endpoint `revert` | Cuando se escriba el adaptador oficial |

---

## 2026-08-21 · Revisión de PRs pendientes y tanda de arreglos del flujo

**Rama:** `claude/review-pending-prs-e227dd`

### El caso

Arrancó como una revisión de los cinco PR que figuraban como pendientes y derivó
en dos cosas más: el cierre del bump de Terraform que estaba trabado hacía dos
semanas, y una tanda de arreglos salidos de que Andres recorrió el flujo en vivo
y fue reportando lo que encontraba.

### Qué cambió

**Pull requests.** Ninguno quedó pendiente:

| PR | Desenlace | Por qué |
| :---- | :---- | :---- |
| [#43](https://github.com/segurolotengopy/SeguroLoTengoDemo/pull/43) | Ya estaba mergeado | La tarjeta de la lista estaba desactualizada |
| [#44](https://github.com/segurolotengopy/SeguroLoTengoDemo/pull/44) | **Cerrado** | Recorte de `CLAUDE.md` escrito contra una versión anterior: conflicto real, y media premisa caducada — la sección `Comandos` de hoy ya **no** es derivable de `package.json` |
| [#45](https://github.com/segurolotengopy/SeguroLoTengoDemo/pull/45) | **Mergeado** (`7166aab`) | Decisión del módulo de identidad independiente. Se corrigió antes una ruta desactualizada (`(flujo)/p5-identidad/` → `(flujo)/identidad/`) |
| [#37](https://github.com/segurolotengopy/SeguroLoTengoDemo/pull/37) | **Mergeado** (`1041b93`) | aws-sdk ×4, minor dentro de v3 |
| [#38](https://github.com/segurolotengopy/SeguroLoTengoDemo/pull/38) | **Mergeado** (`8a84633`) | `@types/node`, solo lockfile |
| [#4](https://github.com/segurolotengopy/SeguroLoTengoDemo/pull/4) | **Cerrado**, reemplazado por [#54](https://github.com/segurolotengopy/SeguroLoTengoDemo/pull/54) (`86a4bbe`) | Ver abajo |

**El caso de #4, que conviene no volver a diagnosticar.** Su Gitleaks en rojo
**nunca fue un secreto filtrado**: era el falso positivo conocido del pepper de
fixture en `puerta.test.ts`, que en `main` está pineado en `.gitleaksignore` con
**dos** fingerprints (`5611d1c` y `228747b`, el segundo por el rebase al mergear
el PR #1). La rama de Dependabot era del 9-ago, estaba 156 commits atrás, y su
copia del archivo solo tenía el primero. Se probaron las tres salidas:
`@dependabot rebase` **nunca fue atendido** (el PR no tiene una sola respuesta del
bot), el botón *Update branch* no está habilitado en el repo, y pushear a mano
sacaba la rama de la gestión de Dependabot igual. Se rehízo desde `main` en un
commit, y de paso el lock quedó en **6.61.0** en vez de 6.58.0. La restricción se
dejó en `~> 6.0`, con la misma amplitud que tenía `~> 5.0`.

**Arreglos del flujo** (9, sin commitear al cierre de la sesión):

1. **Selfie por archivo en el paso 4**, solo con `DEMO_MODE=true`. Decisión de
   Andres del 20-ago que había quedado sin implementar. No es inocua —es el ancla
   biométrica— y entra porque ese camino **ya renunció a la prueba de vida**
   (`decidirPresenciaDemo` comprueba presencia, no vida), así que exigir cámara
   para la selfie no compraba la garantía que aparentaba. Origen `ARCHIVO` sellado
   en la evidencia. `CLAUDE.md` afirmaba lo contrario y se corrigió.
2. **El sexo dejó de completarse por OCR** y pasó a selector obligatorio. Sigue
   viajando en `correcciones.sexo`, así que el contrato del endpoint no cambió.
3. **Callejón sin salida al volver atrás, cerrado en las 7 pantallas** que podían
   rechazar por estado. Antes la pantalla se dibujaba entera y el rechazo llegaba
   al enviar —en el paso 4, después de sacar las tres fotos—. Ahora se pregunta en
   el servidor **antes de dibujar** (`expedienteEnOtroPaso` + `TramiteEnOtroPaso`,
   ahora compartido; `/plan` tenía el suyo propio y se unificó).
4. **«Finalizar y volver al inicio» cierra el trámite en el navegador**
   (`POST /api/flujo/cerrar`). Antes la cookie seguía apuntando al expediente
   terminado y el paso 1 recibía con «Ya tenés un trámite empezado» a quien acababa
   de contratar. No toca el expediente ni levanta el bloqueo por cédula.
5. **El sondeo del pago ya no espera para siempre.** `PAGO_NO_INICIADO` no estaba
   en la lista de motivos terminales, así que cada respuesta se trataba como
   tropiezo pasajero y el sondeo repetía en silencio, indefinidamente. Se agregó
   contador de espera, aviso a los 30 s, y corte a los 5 sondeos sin operación.
6. **La pantalla de firma dejó de afirmar que mandó el enlace.** Ver "el correo"
   más abajo.
7. **Los tres documentos de «Acceso previo a la información»** tenían
   `href="/plan"` escrito a mano: tocar «Aviso de privacidad» justo antes de firmar
   te devolvía al paso 1. Ahora abren su documento en modal.
8. **El «← Volver» del paso 7** apuntaba dos pasos atrás, a declaraciones. Resto de
   antes de D-08. Ahora se deriva de `PASOS_FLUJO`.
9. **El texto bajo el botón del paso 4** enumeraba requisitos incompletos (le
   faltaban los datos económicos, y con el cambio 2 también el sexo).

### Qué hizo Andres

- **Decidió el destino de cada PR**: cerrar #44, mergear #45/#37/#38, cerrar #4 y
  rehacerlo desde `main`, y autorizar cada merge por separado sabiendo que
  **mergear a `main` es desplegar a producción**.
- **Marcó dos PR como ajenos a este repo**: [WhatsAppModular #31](https://github.com/segurolotengopy/WhatsAppModular/pull/31)
  y [encuentrame.bo #3](https://github.com/segurolotengopy/encuentrame.bo/pull/3)
  se atienden desde sus propios directorios, no desde sesiones de este proyecto.
- **Corrió el `terraform plan` del bump del provider**, dos veces:
  - La primera falló con `No valid credential sources found` — **error del comando
    que le pasé**: el provider tiene `profile = var.aws_profile` con `default = null`,
    así que sin `AWS_PROFILE=aab1-demo-deployer` cae a la cadena por defecto y
    termina preguntándole al IMDS de una EC2 que no existe.
  - La segunda devolvió `No changes`, pero **con el provider 5.100.0**: su
    `versions.tf` seguía en `~> 5.0`, así que `init -upgrade` se quedó dentro de la
    serie 5. Se detectó leyendo su lock y su carpeta de providers, y se corrigió el
    cuerpo del PR, que ya afirmaba una verificación que en ese momento no existía.
  - La tercera, con la restricción en `~> 6.0`, bajó **6.61.0** y devolvió
    `No changes`. Esa es la buena.
- **Recorrió el flujo en vivo** y reportó, en este orden: selfie por archivo
  bloqueada, el paso 6 trabado sin correo y sin poder cambiar de canal, la vuelta
  atrás sin poder cambiar nada, el sexo autocompletado, el paso 7 esperando sin
  contador, «Finalizar» devolviendo al panel de trámite empezado, y el correo que
  no llegó **después de dos intentos**.
- **Pidió una auditoría con agentes** de botones, vueltas atrás y envíos reales.

### Verificaciones

| Qué | Resultado |
| :---- | :---- |
| `npm run typecheck` · `npm run lint` | Limpios |
| `npm test` | **1120 tests**, 82 archivos, todo en verde |
| `npm run test:e2e` | **7 pasan**, 3 se saltean, **2 escenarios intermitentes** (ver abajo) |
| CI sobre `main` fusionado (`8a84633`, `86a4bbe`) | 4/4 en verde, Gitleaks incluido |
| Amplify, job 55 (`8a84633`) | `SUCCEED`; `/plan` responde **HTTP 200**, la raíz **307** |
| `terraform validate` con provider 6 | `Success! The configuration is valid.` — ningún argumento removido ni renombrado |
| `terraform plan` con **6.61.0** contra el state real | `No changes` |

**Los dos intermitentes de E2E, con su prueba:**

- **06 · vencimiento** falla ~1 de cada 2 corridas. Se verificó guardando la tanda
  entera con `git stash` y corriéndolo sobre el árbol limpio: **falla igual, en la
  misma proporción**. Es preexistente. No perder tiempo buscándole una regresión.
- **07 · firma atómica** comprueba que mientras las firmas institucionales no
  llegan el pago sigue bloqueado (409), pero esa ventana **la cierra el propio
  sondeo de la pantalla**, que reintenta cada dos segundos. Aislado pasa siempre.

**Dos regresiones que el E2E atrapó durante la tanda**, las dos por el chequeo
previo del punto 3, y las dos con la misma forma: hay pantallas que **siguen
siendo dueñas del estado que producen** porque no navegan solas. `/pago` conserva
`PAGO_CONFIRMADO` (se queda mostrando el comprobante y el enlace a la
confirmación) y `/firma` conserva `FIRMADO` (su sondeo lleva a la persona al pago).
De ahí sale el parámetro `tambienPropios` de `expedienteEnOtroPaso`.

### Qué se decidió NO hacer, y por qué

- **El canal de firma sigue clavado** una vez pedido el enlace, sin botón para
  descartar el acto. Arreglarlo pide una forma de cancelar en el dominio, y hoy el
  enlace no se envía a ningún lado igual.
- **Los mensajes `ESTADO_INVALIDO` de los formularios siguen sin enlace de vuelta.**
  Solo se disparan en la ventana angosta entre que el servidor dibujó la pantalla y
  que se envía el formulario con el estado ya cambiado desde otra pestaña.
- **Los dos E2E intermitentes no se tocaron.** Hacerlos estables exige decidir qué
  deben afirmar, y eso no corresponde colar en medio de arreglos de producto.

### El correo del paso 6 — respuesta definitiva

Andres lo probó dos veces esperando el enlace de firma. **No podía llegar, y no
es SES ni la ventana de Meta.** `SignatureProvider` está en mock porque
`INTEGRATION_SIGNATURE` no está definida, y su `iniciarFirma` **no hace una sola
llamada de red**: fabrica una URL simulada y la guarda. Da igual el canal elegido.
Ninguna variable de entorno cambia eso — `INTEGRATION_SIGNATURE=live` haría que la
app tirara un `throw` explícito, porque el adaptador oficial no existe.

La pantalla decía «Enviamos el enlace de firma a tu canal verificado», que es una
afirmación falsa y costó dos intentos. En demostración ahora dice que el enlace no
se envía a ningún canal y remite al firmador de la propia pantalla.

**Del mismo inventario salieron dos cosas más:**

- **El paso 7 promete un aviso que ningún código intenta**: «si el pago no se
  completa dentro de 24 horas, la solicitud vence y se avisa por WhatsApp y
  correo». En la transición a `VENCIDO` no hay llamada a `MessagingProvider`. Es
  una promesa al consumidor sin implementación.
- **`INTEGRATION_OTP_EMAIL=live` y `OTP_EMAIL_FROM` están en Amplify y no las
  ejercita nada** en el flujo de 8 pasos (D-06 retiró el OTP de correo). No se
  quitan: la opción C de la firma las va a necesitar.

### Queda abierto

| Tema | De quién es la decisión |
| :---- | :---- |
| **La promesa de aviso de vencimiento del paso 7**: implementarla o sacar la frase | Legal — es lo único de esta tanda con filo legal antes de mostrarle el flujo a alguien |
| Armar el PR de la tanda (24 archivos, +565/−224) | Andres |
| Cancelar el acto de firma para poder cambiar de canal | Producto |
| Qué deben afirmar los dos E2E intermitentes | Andres |
| Persistir el estado del mock de pago (hoy vive en memoria de la instancia, y Amplify puede escalar) | Andres, si reaparece en demostraciones |
| **D1: quién ejecuta la firma del cliente** — Code100 confirmó por escrito que no puede | Gerencia y Legal. Sigue bloqueando el adaptador oficial |
