# Análisis exhaustivo — Resolución SS.SG. N° 210/2025 contra el sistema actual

**Fecha del análisis:** 26-ago-2026 · **Rama:** `claude/analisis-ra-215-2025-fre8rp`

---

## 0. Aclaración previa: qué documento es este (y qué no es)

El pedido nombraba una «RA 215/2025». El PDF analizado (entregado como
`215_2025.pdf`) es, según su carátula, sus cinco páginas y la firma digital de
la Superintendente, la **Resolución SS.SG. N° 210/2025 — «Condiciones mínimas
para la comercialización de seguros por medios electrónicos y canales no
presenciales»**, Asunción, 25 de setiembre de 2025, firmada digitalmente por
Adriana Jazmín Bernal Lugo (Superintendente de Seguros) el 26-09-2025. Es
**el mismo documento** que ya vive en el repo como
`docs/normativa/210 2025.pdf` (misma carátula y contenido; distinto escaneo).

Dos números parecidos con los que **no** hay que confundirla:

- **Res. SS.SG. N° 215/2025** (BCP): existe, pero trata la **renovación de
  inscripción de matrículas de auxiliares del seguro** — un acto
  administrativo de renovación, sin relación con la comercialización
  electrónica.
- **Res. SS.SG. N° 215/15** (año 2015): la resolución histórica de pólizas y
  modelos que la matriz de cumplimiento CSV cita en ~30 filas. Sigue vigente:
  la 210/2025 **no contiene cláusula derogatoria** — su parte resolutiva solo
  establece las condiciones mínimas del Anexo I y ordena publicar, registrar
  y archivar. Las dos capas conviven.

## 1. Ficha del documento

| Campo | Valor |
| :--- | :--- |
| Norma | Resolución SS.SG. N° 210/2025 |
| Emisor | Superintendencia de Seguros (BCP), en ejercicio de la Ley 827/96 art. 61 inc. b) |
| Fecha | 25-09-2025 (firma digital 26-09-2025) |
| Estructura | Parte resolutiva (2 puntos) + **Anexo I con 10 artículos** |
| Considerandos | Ley 827/96; Ley 1183/1985 (Código Civil); Ley 4868/2013 (comercio electrónico); Ley 6822/2021 (firma electrónica); principios IAIS |
| En el repo | `docs/normativa/210 2025.pdf` · fuente citada por la Matriz Legal V4 (§10: «Resolucion SIS 210/2025 — PDF oficial verificado») |

## 2. Análisis artículo por artículo contra lo que tenemos

### Art. 1 — Objeto y alcance — ✅ CUBIERTO

Aplica a aseguradoras, agentes y corredores autorizados por la Ley 827/96.
Encaja exactamente con nuestro triángulo: Alianza Garantía (aseguradora),
Interseguros S.A. (corredor, Matrícula SIS 118) y el portal como canal del
corredor. La Matriz V4 §1 lo da CERRADO y `src/domain/entidades.ts` es la
fuente única de esos datos.

### Art. 2 — Criterios esenciales — ⚠️ PARCIAL (incisos c, d, e)

| Inciso | Exigencia | Estado en el sistema |
| :--- | :--- | :--- |
| a) Trato justo, digno y no discriminatorio | ética, información clara, sin prácticas abusivas | ✅ Diseño de mínima fricción; regla de cierre de la Matriz V4 §4 (no discriminación, Ley 3940/2009 para VIH); botones deshabilitados hasta cumplir requisitos, sin casillas preseleccionadas |
| b) Transparencia y accesibilidad de la información | información clara, completa, precisa | ✅ P1 muestra coberturas, carencias, exclusiones y premio total IVA incluido (CSV filas 5 y 10); brochure y condiciones bajo demanda con evidencia de apertura |
| c) Enfoque basado en riesgos | **evaluación basada en riesgos del canal, por la aseguradora** | ❌ **Sin artefacto**: no existe documento de evaluación de riesgos del canal firmado por Alianza. Es organizacional, no de código, pero nadie lo tiene anotado como compuerta de producción (la §8 de la matriz no lo lista) |
| d) Gobernanza tecnológica efectiva | sistema de gobernanza, continuidad, control interno | ⚠️ El repo aporta controles del operador (CI de 4 jobs, `POLITICA_DE_DESPLIEGUE.md`, Snyk, arquitectura de puertos), pero el artículo se lo exige **a la aseguradora** — falta el encuadre formal de Alianza |
| e) Protección de datos y ciberseguridad activa | confidencialidad, integridad, disponibilidad | ⚠️ Núcleo fuerte (reglas inviolables #2/#6/#7, datos sensibles aislados); **CMP-12 (aviso de privacidad) y CMP-13 (cookies) están en L6, pendiente** |
| f) Innovación responsable | adopción ética y prudente | ✅ Es la filosofía documentada del repo («el código debe hacer las reglas imposibles de violar») |

### Art. 3 — Definición de medios electrónicos — ✅ CUBIERTO

Lista enunciativa (apps, sitios web, mensajería, redes, llamadas). El portal
web cae de lleno. La Matriz V4 §1 cierra WhatsApp como canal de **consultas
solamente**: mientras no se venda por WhatsApp ni por teléfono, la obligación
de grabación total de llamadas del art. 9 no se activa. **Si algún día se
comercializa por WhatsApp, este artículo arrastra al art. 9 tercer párrafo.**

### Art. 4 — Firma del proponente (cualificada o simple + respaldo) — ✅ CUBIERTO — es nuestro artículo pilar

Exige: propuesta y documentos precontractuales suscritos con firma
cualificada **o simple**; si es simple, respaldada por **autenticación previa
(OTP u otros medios idóneos)** que garantice (1) identificación del firmante,
(2) origen e integridad de los datos y (3) trazabilidad de la operación.

Cobertura punto por punto:

1. **Firma simple del cliente** — invariante con test en
   `src/domain/firmantes-documento.ts` («el cliente firma primero y firma
   simple»).
2. **OTP previo** — OTP de WhatsApp (paso 2), 6 dígitos, uso único, 5 min,
   3 intentos, solo hash persistido. **D-07 cita expresamente este artículo**
   como base para que el portal no emita un OTP de firma propio y el acto
   ocurra dentro del flujo del firmador.
3. **Identificación del firmante** — verificación biométrica P5 (umbral
   facial 99, `DecisionBiometrica` con puntuación+umbral+versiones).
4. **Origen e integridad** — PDF único cerrado y hasheado SHA-256 **antes**
   de habilitar la firma (regla inviolable #4, determinismo del generador).
5. **Trazabilidad** — `RegistroEvidencia` append-only con fecha, IP,
   dispositivo, sesión y versión+literal del texto aceptado.

Además, este artículo es la **base normativa de la opción recomendada para
D1** (quién ejecuta la firma del cliente): Code100 no puede recibirla (C1 de
`Code100 - Respuestas C1 a C12.md`), y el art. 4 valida jurídicamente una
firma simple respaldada por exactamente lo que la plataforma ya produce.
D1 sigue **pendiente de Gerencia y Legal**, pero no por falta de respaldo
normativo.

### Art. 5 — Firma cualificada del intermediario — ✅ CUBIERTO (simulado en demo)

Si comercializa un intermediario, la propuesta debe llevar su firma
electrónica **cualificada**. Interseguros firma cualificada la propuesta:
Matriz V4 §7 orden 4, CSV fila 38, e invariante con test («toda firma
institucional es cualificada»). En demo el certificado es simulado y se
declara (`DEMO-CERT-…`); la verificación de certificados cualificados
vigentes en Code100 es la compuerta de producción §8.5.

Nota: el artículo exige **solo** la firma del intermediario sobre la
propuesta. Que Alianza también la firme (D-13) es un plus interno —
divergencia declarada con la matriz (ALR-07) — no un requisito de esta norma
ni un incumplimiento.

### Art. 6 — Consentimiento informado del tomador — ✅ CUBIERTO

Informar alcance, derechos y obligaciones **antes** del consentimiento, y
poder **corroborar** que fue libre, expreso e inequívoco. Lo cubren: la
autorización inicial de P3 (estado `AUTORIZADO`), las declaraciones con
textos versionados, la revisión del PDF completo antes de firmar (Matriz §4:
«tuve acceso al PDF único… pude revisarlo»), la advertencia del art. 1556
integrada al PDF con sello de tiempo (CMP-09), y la evidencia append-only que
conserva la versión exacta y el literal de cada texto aceptado.

### Art. 7 — Transparencia: información mínima — ⚠️ PARCIAL (le faltan datos, no código)

| Inciso | Exigencia | Estado |
| :--- | :--- | :--- |
| a) Contacto y domicilio de aseguradora e intermediario | ambos, visibles | ⚠️ Domicilios y estructura: ✅ (`entidades.ts` + `HeaderInstitucional` permanente + pie de P9). Pero **teléfono/correo de atención de Interseguros y correo de Alianza siguen en `null`** (D-19: «Andres/Rodrigo pasan los datos cuando los tengan») — hoy la pantalla omite datos que este inciso pide mostrar |
| b) Características, coberturas, requisitos, exclusiones | claras | ✅ P1 + aclaración `coberturas-exclusiones-condiciones` enlazada; modelos registrados definitivos = pendiente Alianza (§8.3) |
| c) Costo total y forma de pago de la prima | por producto | ⚠️ Premio total IVA incluido: ✅. **Desglose prima/impuestos oficial: PENDIENTE ALIANZA** (D-04, cifras provisionales rotuladas) |
| d) Procedimiento de denuncia de siniestros | informado | ⚠️ El texto existe (`ACLARACION_CONSULTAS_RECLAMOS`, con canales, pasos e instancias ante la SIS) y P9 muestra a Alianza con rol «Emisión de la póliza, cobertura y reclamos», **pero ninguna pantalla enlaza esa aclaración todavía** — hoy solo `coberturas` (P1) y `requisitosIdentidad` (P5) están enlazadas. Cae dentro de CMP-10/L6 |

**Hallazgo puntual:** `ACLARACION_CONSULTAS_RECLAMOS` publica
`atencion@segurolotengo.com.py` — un correo que no está cerrado por la matriz
(el único cerrado es `segurolotengo@interseguros360.com`, y solo para
retracto y derechos de datos). Contradice la regla D-19 de «no inventar datos
de contacto». Corregirlo antes de enlazar esa aclaración.

### Art. 8 — Contratación de servicios de tecnología — ⚠️ FUERA DEL PORTAL (contractual)

Aseguradoras e intermediarios que contraten empresas tecnológicas son
**plenamente responsables** ante la SIS y los tomadores. Es el artículo que
encuadra a AAB1 como operador tecnológico: la responsabilidad regulatoria es
de Interseguros/Alianza, no delegable. El portal ya presenta correctamente a
Interseguros como operador (Matriz §5, CERRADO: «no se presenta como entidad
separada»; Res. 190/2025 y Circ. 011/2025 aplicadas vía `IDENTIFICACION_SIS`
y `marcaVisible()`). Lo que falta es **contractual**: que el contrato de
servicios AAB1↔Interseguros exista y refleje este reparto. No está en las
compuertas §8 de la matriz — conviene sumarlo.

### Art. 9 — Conservación de la información — ⚠️ PARCIAL: núcleo sólido, cierre en L6

Exige: mecanismos para obtener/conservar/resguardar la información;
trazabilidad de documentos y del consentimiento incluyendo **metadatos,
dirección IP, fecha y hora, códigos de validación**, identificación
electrónica y origen e integridad; llamadas grabadas en su totalidad (si se
vende por teléfono); **conservación mínima 2 años desde el vencimiento de la
póliza**, disponible para el cliente y la SIS.

- ✅ **Núcleo implementado:** `RegistroEvidencia` (fecha ISO, IP,
  dispositivo, sesión, versión+literal del texto, resultado) append-only
  (regla #10); SHA-256 de documentos; hash del OTP como código de validación
  sin exponer el código (regla #2); origen de confirmación de firma
  (`SONDEO`/`RETORNO_NAVEGADOR`) en evidencia; disponibilidad para el
  cliente (3 descargables, D-05) y para el staff (consola administrativa) y
  verificación pública `/verificar/<código>` (CMP-06).
- ⚠️ **Trazabilidad completa (todos los clics, descargas, reproducciones y
  aceptaciones):** es exactamente **TRV-01**, que el plan v2 respalda citando
  «Res. 210/25 art. 9» — **Lote 6, el único pendiente**.
- ⚠️ **Plazos de conservación (2/5/10 años):** Matriz §6 los declara
  OBLIGATORIO; CMP-14 dice «política documentada (L6); borrado programado es
  compuerta de producción». Hoy no hay política escrita ni configuración de
  retención en infra (el único TTL es el del OTP, correcto).
- ✅ **Llamadas grabadas:** no aplica hoy (no se vende por teléfono ni
  WhatsApp; canal cerrado a consultas).

### Art. 10 — Procedimiento escrito y planes de contingencia — ❌ BRECHA ORGANIZACIONAL

Procedimiento escrito de comercialización electrónica **aprobado por el
Directorio de la aseguradora**, con controles de protección de datos; planes
de contingencia y protocolos ante incidentes, **también aprobados por el
Directorio**. Nada de esto puede vivir en el repo: son actos de gobierno de
Alianza. El repo aporta insumos (este flujo documentado,
`POLITICA_DE_DESPLIEGUE.md`, CSV filas 78/81/82 sobre incidentes y
continuidad), pero el documento formal aprobado por Directorio **no existe y
no está anotado en ninguna compuerta**. Es el pendiente más claramente
nuevo que deja esta resolución.

## 3. Resumen

| Art. | Tema | Estado |
| :--- | :--- | :--- |
| 1 | Objeto y alcance | ✅ Cubierto |
| 2 | Criterios esenciales | ⚠️ a/b/f ✅ · c/d organizacionales sin artefacto · e cierra en L6 |
| 3 | Definición de canales | ✅ Cubierto (alerta si se vende por WhatsApp/teléfono) |
| 4 | Firma del proponente | ✅ Cubierto — base de D-07 y de la opción recomendada para D1 |
| 5 | Firma cualificada del intermediario | ✅ Cubierto (certificados reales = compuerta §8.5) |
| 6 | Consentimiento informado | ✅ Cubierto |
| 7 | Información mínima | ⚠️ Estructura ✅ · faltan datos D-19, desglose de Alianza y enlazar reclamos (CMP-10/L6) |
| 8 | Servicios de tecnología | ⚠️ Presentación ✅ · contrato AAB1↔Interseguros fuera de compuertas |
| 9 | Conservación | ⚠️ Núcleo ✅ · TRV-01 y política de retención = L6/CMP-14 |
| 10 | Procedimiento y contingencia por Directorio | ❌ Organizacional, sin artefacto ni compuerta |

## 4. Acciones que deja este análisis

1. **CSV de cumplimiento sin filas de la 210/2025.** La matriz CSV — fuente
   regulatoria operativa del repo — cita `Res. SS SG. 215/15` en ~30 filas y
   **ninguna** cita la 210/2025. La Matriz V4 la incorpora, pero la regla de
   trabajo del proyecto manda citar filas del CSV. Agregar filas (o columna
   de norma concurrente) para los arts. 4, 5, 6, 7, 9 y 10.
2. **Corregir el correo inventado** en `ACLARACION_CONSULTAS_RECLAMOS`
   (`atencion@segurolotengo.com.py`) antes de que CMP-10/L6 enlace esa
   aclaración (viola el criterio D-19).
3. **Sumar tres compuertas de producción** a la lista §8 de la matriz:
   evaluación de riesgos del canal (art. 2.c), contrato de servicios
   tecnológicos AAB1↔Interseguros (art. 8) y procedimiento + plan de
   contingencia aprobados por el Directorio de Alianza (art. 10).
4. **L6 es también cierre normativo, no solo hardening:** TRV-01 (art. 9),
   CMP-10 (art. 7.d), CMP-12/13 (art. 2.e) y CMP-14 (art. 9, plazos) son las
   piezas de esta resolución que faltan. Al priorizar L6 conviene tratarlas
   como obligación de la 210/2025, no como mejoras.
5. **D-19 pasa a tener plazo normativo:** los contactos en `null` (teléfono y
   correos de atención) son información mínima del art. 7.a; conseguir los
   datos reales deja de ser cosmético.
6. **Renombrar mentalmente, no en disco:** el archivo del repo
   `docs/normativa/210 2025.pdf` ya está bien nombrado; la referencia
   «RA 215/2025» corresponde a otra resolución (renovación de matrículas) que
   no afecta al flujo — solo confirma que la matrícula del corredor debe
   estar vigente, que ya es dato visible (`Matrícula SIS N° 118`).
