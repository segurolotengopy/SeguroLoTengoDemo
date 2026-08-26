# Análisis exhaustivo — Resolución SS.SG. N° 210/2025 contra el sistema actual

**Fecha del análisis:** 26-ago-2026 · **Rama:** `claude/analisis-ra-215-2025-fre8rp`

> **v2 (mismo día):** se incorporó un segundo documento —el memo
> *Actualizaciones normativas relevantes* (corte 26-ago-2026)— y el análisis
> cierra ahora con un **criterio normativo unificado** (§7). Las secciones
> §5–§8 son las nuevas; §0–§4 conservan el análisis artículo por artículo de
> la 210/2025, con una corrección en §0 sobre la numeración de la resolución
> de modelos.
>
> **v3 (mismo día):** se incorporó un tercer documento —el memo *Marco
> Regulatorio de Firma Electrónica para Seguros en Paraguay*— que cierra la
> dirección técnica de D1 (§9). El criterio operativo consolidado de los
> tres documentos, con el mapa de mecanismos AWS y de seguridad, vive ahora
> en **`docs/CRITERIO_UNIFICADO_NORMATIVA_Y_SEGURIDAD.md`**; este archivo
> queda como el análisis de detalle que lo respalda.
>
> **v4 (mismo día):** el archivo `215_2025.pdf` se presentó otra vez como la
> resolución «215» del proyecto. Es, de nuevo, la **210/2025** — la
> comprobación y la desambiguación de los tres «215» quedaron asentadas en
> §0 y, con más detalle, en `docs/normativa/INDICE.md` §0.

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

> **Reafirmado el 26-ago-2026 (v4).** El archivo llamado `215_2025.pdf` se
> presentó dos veces como si fuera la resolución «215» del proyecto. Las dos
> veces era el mismo archivo, byte por byte, y las dos veces era la
> **210/2025**. La comprobación no depende de ninguna fuente externa: el PDF
> tiene una parte resolutiva de **dos puntos** y un Anexo I de **diez
> artículos**, mientras que las filas «215» de la matriz citan *«Anexo 1,
> numeral 11.14»*, *«numeral 6.13.14»*, *«numerales 12.8 y 6.13.6»*, *«punto
> resolutivo 14»* y *«punto 9(d)»* — numerales y puntos que este documento no
> tiene. Se dejó la desambiguación asentada en `docs/normativa/INDICE.md` §0
> para que no vuelva a ocurrir. **Consecuencia:** tener este PDF no cubre la
> brecha de la 215/2017, que sigue sin texto oficial en el repositorio.

Dos números parecidos con los que **no** hay que confundirla:

- **Res. SS.SG. N° 215/2025** (BCP): existe, pero trata la **renovación de
  inscripción de matrículas de auxiliares del seguro** — un acto
  administrativo de renovación, sin relación con la comercialización
  electrónica.
- **La resolución de pólizas y modelos que el CSV cita como «Res. SS SG.
  215/15»** (~38 menciones). **Corrección (v2):** la resolución vigente de
  modelos, numeración y contenido contractual es la **Res. SIS N° 215/2017**
  (sustituyó a la 292/2007; modificada por las Res. 238/2019 y 181/2020) —
  así la citan la Matriz V4 §10, la ficha oficial del BCP y
  `src/domain/tipos.ts`. **Corregida (v3):** eran 72 apariciones en todo el
  repositorio —CSV, `CLAUDE.md`, `.claude/agents/` y 14 módulos de `src/`—,
  todas heredadas de la primera cita mal copiada; hoy dicen «215/17» y un
  test impide que vuelvan (§8.9). La prueba de que es la misma resolución y
  no otra: la Matriz V4 §5 cita los **mismos numerales** (11.3, 11.4, 11.6,
  11.13, 11.14, 9.f) que el CSV atribuía a «215/15». Sigue vigente: la 210/2025 **no
  contiene cláusula derogatoria** — su parte resolutiva solo establece las
  condiciones mínimas del Anexo I y ordena publicar, registrar y archivar.
  Las dos capas conviven.

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

## 4. Acciones del primer análisis

> Estas seis acciones siguen vigentes; §8 las absorbe y las amplía con lo que
> aporta el segundo documento.

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

---

## 5. Segundo documento: memo «Actualizaciones normativas relevantes»

**Naturaleza:** informe de investigación jurídica (corte **26-ago-2026**, 17
páginas) que barre el marco completo aplicable al portal y clasifica cada
norma en DIRECTA / INSTITUCIONAL / CONDICIONAL / FUTURA / HISTÓRICA. Su
conclusión coincide con la nuestra en lo central: **nada de 2026 derogó ni
modificó la 210/2025 ni la 231/2025**; la arquitectura jurídica del proyecto
se mantiene.

**Cautela de fuente:** es un memo de investigación, no una norma. Para la
regla de trabajo del repo («nunca cites de memoria un artículo de ley») sirve
como **mapa**, no como fuente de verdad final: cada norma que introduce y que
el proyecto decida usar debe incorporarse como PDF oficial a
`docs/normativa/` (como ya se hizo con 210, 231, 190, 011 y 117) antes de
citarse en pantallas o en la matriz.

### 5.1 Lo que el memo agrega y el repo no tenía

| Novedad | Qué establece | Impacto |
| :--- | :--- | :--- |
| **Res. SIS N° 205/2025** (19-sep-2025) | Renovación de la matrícula corredora de **Interseguros**: SIS 118, ramos Patrimoniales y Vida, **vigencia hasta el 18-sep-2027**, y las propuestas deben ser firmadas por **Rodrigo Fernández Echazú, agente matrícula N° 2918** | La configuración de firmantes (`firmantes-documento.ts`) trabaja por **rol**, sin persona nominada — correcto para el demo, pero la compuerta §8.5 debe verificar que el certificado cualificado de Interseguros en Code100 sea **el de esa persona**. Y la renovación 18-sep-2027 pasa a ser una fecha de calendario regulatorio (bajo el régimen nuevo 031/2026 + 117/2026) |
| **Res. SIS N° 219/2018 (MGCTI)** | Gobierno y control de tecnología exigible a las aseguradoras: seguridad, continuidad, accesos, proveedores, respaldo, riesgo tecnológico, incidentes | **Cierra el hueco de norma** que el primer análisis señaló en los arts. 2.c, 2.d y 10 de la 210/2025: la evaluación de riesgos, la gobernanza y los planes de contingencia no son solo «organizacionales sin artefacto» — tienen norma propia que Alianza ya debería estar cumpliendo como marco |
| **Res. SIS N° 030/2025** | Consultas, quejas y reclamos ante la SIS (derogó la 022/2024); el portal debe ofrecer los canales de atención de ambas entidades | Refuerza con norma específica el art. 7.d de la 210/2025 y le pone más presión a **D-19** (contactos en `null`) y al enlace pendiente de `ACLARACION_CONSULTAS_RECLAMOS` |
| **Ley N° 7503/2025 + reglamentos BCP 2026 (SIPAP)** | Marco nuevo de proveedores de pago; aplica a Bancard. El memo deriva: **el dinero debe ingresar directamente a Alianza**; ni Interseguros ni el portal como beneficiarios del premio | Ya está implícito en la compuerta §8.7 («definir comercio receptor»), pero ahora con fundamento legal: el comercio Bancard debe ser **Alianza**. El portal ya cumple lo demás (solo referencia, importe, fecha, estado — regla inviolable #6) |
| **Ley N° 5830/2017 + Decreto 8000/2017 (No Molestar)** | Consentimiento comercial separado del contractual, nunca preseleccionado, revocable; responsabilidad aun si contacta un tercero | **Ya cumplido**: Matriz §4 fila Marketing («desmarcado; separado y revocable», D-01) |
| **Code100 con doble condición ante ACRAIZ** | Es prestador **cualificado y también no cualificado**: OTP/enlace/aceptación/evidencias = firma **no** cualificada; certificado + dispositivo cualificado = cualificada. «Debe contratarse y documentarse exactamente qué servicio utiliza cada firmante» | Confirma por tercera vía lo que C1 ya dijo y lo que `firmantes-documento.ts` hace cumplir con test. Agrega un requisito **contractual**: el contrato con Code100 debe identificar el servicio por firmante (compuerta §8.5) |
| **Normas derogadas que no deben citarse** | Ley 4017/2010 y 4610/2012 (derogadas por la 6822/2021); Res. 136/2018 (derogada por la 231/2025); Res. 292/2007 (sustituida por la **215/2017**); Res. 022/2024 (por la 030/2025); Res. 303/2024 y arts. 1–8 de la Res. 14/96 (por la 031/2026) | Lista de control para el lint normativo del proyecto: ninguna pantalla, PDF ni fila del CSV debe citarlas como fundamento vigente. Hoy el repo no las cita — mantenerlo así |

### 5.2 El punto jurídico nuevo más serio: CPC y exigibilidad de la prima

El memo recuerda que el Código Civil dispone que **la prima no es exigible
sino contra entrega de la póliza o de un certificado o instrumento
provisional de cobertura**, y concluye que el CPC «debe existir al momento de
exigir o cobrar la prima, **no únicamente como documento generado con
posterioridad al cobro**» — con la nota de que esto «debe validarlo Alianza
con su asesoría jurídica».

Cómo queda frente a lo implementado (D-12, CMP-07): hoy `confirmarPagoP7`
**cierra y hashea el CPC antes de transicionar** y lo asienta en la misma
escritura que confirma el cobro; si el certificado no se puede emitir, el
pago **no se confirma** (`CERTIFICADO_NO_EMITIDO`). Es decir: la operación ya
es atómica y el orden interno ya es «certificado primero, asiento del cobro
después». Lo que queda expuesto es un matiz: la **autorización del débito en
Bancard ocurre antes** de que el CPC exista. Dos lecturas posibles —(a) la
prima se «exige» recién con la confirmación, y ahí el CPC ya existe
(cumplimos por construcción); (b) la prima se «exige» al abrir la operación
de pago, y entonces haría falta un instrumento previo—. **La lectura la debe
cerrar Alianza/Legal**; el diseño actual soporta ambas sin reescritura
(la emisión es inyectada y atómica), así que es una consulta jurídica, no un
cambio de código. Registrarla como pendiente junto a D1.

---

## 6. Qué cambia del análisis de la 210/2025 con el memo

- **Art. 2.c/2.d y art. 10** dejan de ser brechas «sin norma con nombre»: el
  marco es la **Res. 219/2018 (MGCTI)** — la evaluación de riesgos del canal,
  la gobernanza tecnológica y los planes de contingencia deben producirse
  bajo ese estándar de Alianza, y la compuerta de producción nueva debe
  citarlo.
- **Art. 7.a/7.d** ganan una segunda norma directa: la **Res. 030/2025**
  (canales de reclamo de ambas entidades). D-19 y el enlace de la aclaración
  de reclamos pasan de «pendiente de dato» a «pendiente con dos normas
  esperando».
- **Art. 4/5** quedan confirmados por tercera fuente (ACRAIZ): la firma del
  cliente por Code100 es no cualificada salvo certificado propio — la
  arquitectura de D-13 (cliente simple + institucionales cualificadas) es
  exactamente la que el marco permite.
- La **numeración de la resolución de modelos** se corrige: es **215/2017**,
  no «215/15» (§0).
- Se agrega el **matiz CPC/exigibilidad de la prima** (§5.2), que no surge de
  la 210/2025 sino del Código Civil, y queda como consulta a Alianza/Legal.

---

## 7. Criterio normativo unificado

La regla de decisión que queda tras cruzar los dos documentos con la Matriz
V4, el CSV y el código. **Jerarquía de fuentes para cualquier duda nueva:**
norma oficial en `docs/normativa/` → Matriz V4 → CSV de cumplimiento (con la
errata 215/15→215/17 presente) → memos de investigación como mapa.

| # | Tema | Norma rectora | Estado en SeguroLoTengo |
| :--- | :--- | :--- | :--- |
| 1 | Venta electrónica (norma central) | **Res. SIS 210/2025** | ✅ núcleo cumplido (§2); cierre en L6 (TRV-01, CMP-10/12/13/14) |
| 2 | Firma del cliente | Ley 6822/2021 + **Res. 210/2025 art. 4** (autenticación + evidencias) | ✅ firma simple + OTP + biometría + hash + evidencia; D1 (quién la ejecuta) pendiente de Gerencia/Legal, con base normativa clara |
| 3 | Firma del corredor | Ley 827/96 art. 76 + **Res. 205/2025** (firmante nominado: R. Fernández Echazú, mat. 2918) | ✅ cualificada por rol; la persona y su certificado son compuerta §8.5 |
| 4 | Póliza y CPC | **Res. 231/2025** (firma cualificada de Alianza, QR de verificación, conservación) | ✅ CPC prefirmado por Alianza, QR a `/verificar/<código>`; matiz de exigibilidad de la prima → consulta Alianza/Legal (§5.2) |
| 5 | Comercio electrónico | Ley 4868/2013 + Decreto 1165/2014 | ⚠️ resumen revisable y acuse cumplidos; información del canal = CMP-10 (L6) |
| 6 | Información al consumidor | Ley 1334/98 | ✅ premio total IVA incluido, carencias y exclusiones a la vista |
| 7 | Comunicaciones comerciales | Ley 5830/2017 + Decreto 8000/2017 | ✅ casilla separada, desmarcada y revocable (D-01) |
| 8 | Datos personales | Régimen actual + **Ley 7593/2025** (plena vigencia fines 2027) | ⚠️ diseño ya conforme en lo estructural; aviso de privacidad y panel de cookies = CMP-12/13 (L6). Construir todo lo nuevo ya conforme a la 7593 |
| 9 | FIPF, origen de fondos y PEP | Res. SEPRELAD 71/2019 y 50/2019 | ✅ FIPF integrado al PDF único; PEP deriva a análisis reforzado, nunca rechazo automático; biometría limitada a verificación |
| 10 | Seguridad y trazabilidad | **Res. 210/2025 art. 9 + Res. 219/2018 + Res. 167/2010** | ⚠️ evidencia núcleo ✅; TRV-01 y política de retención 2/5/10 años = L6; marco MGCTI de Alianza = compuerta nueva |
| 11 | Pagos | **Ley 7503/2025** + reglamentos BCP 2026 | ✅ portal sin PAN/CVV, solo referencia Bancard; comercio receptor = **Alianza** (compuerta §8.7, ahora con fundamento legal) |
| 12 | Factura | Decreto 872/2023 + normativa SIFEN/DNIT | ✅ el comprobante del portal se declara «no factura»; la factura la emite Alianza (fila 40) |
| 13 | Identidad del canal y marca | Res. 190/2025 + Circ. 011/2025 + **Res. 205/2025** | ✅ `IDENTIFICACION_SIS` permanente; marca detrás de `MARCA_FANTASIA_AUTORIZADA=false` (D-03) |
| 14 | Modelos y contenido contractual | **Res. 215/2017** (mod. 238/2019, 181/2020) — no «215/15» | ✅ estructura de Solicitud/FIPF conforme; corregir la cita en CSV y CLAUDE.md |
| 15 | Matriculación de auxiliares | Res. 031/2026 + 117/2026 (+ renovaciones 205/2025 y 215/2025) | ✅ no toca pantallas; calendario: renovación de Interseguros antes del **18-sep-2027** |

**Síntesis del criterio:** la arquitectura jurídica del proyecto **no cambia**
con ninguno de los dos documentos — la 210/2025 es la norma central y ya es
la columna vertebral de la Matriz V4 y del Plan v2. Lo que los dos documentos
juntos agregan es: (1) **L6 es cierre normativo obligatorio**, no hardening
opcional; (2) tres compuertas de producción nuevas ahora **con norma con
nombre** (219/2018 para gobernanza/contingencia, 030/2025 para canales de
reclamo, 7503/2025 para el comercio receptor); (3) dos consultas jurídicas a
Alianza que el código ya soporta sin reescritura (exigibilidad de la prima
vs. CPC, y quién ejecuta la firma del cliente); y (4) higiene de citas
(215/2017, derogadas prohibidas, PDFs oficiales a `docs/normativa/`).

---

## 8. Lista de acciones consolidada (reemplaza y amplía §4)

> **Estado al 26-ago-2026.** Las acciones 1, 3, 6 y 9 quedaron **aplicadas**
> en esta misma rama; la 2 quedó **preparada** (el entorno no puede
> descargar los PDF); las demás son de Alianza, Legal o negocio.

1. ✅ **APLICADA — CSV de cumplimiento.** Errata **«215/15» → «215/17»**
   corregida en las 72 apariciones del repositorio (CSV, `CLAUDE.md`,
   `.claude/agents/` y 14 módulos de `src/`), y **ocho filas nuevas** (86-93)
   con los arts. 4, 5, 6, 7, 8, 9 y 10 de la 210/2025, redactadas leyendo el
   PDF oficial que ya estaba en `docs/normativa/`. Se agregó también el art. 8
   —que la lista original no pedía— porque es el que sostiene la compuerta
   del contrato de servicios tecnológicos. La numeración quedó correlativa
   1-93 y las 93 filas tienen sus cuatro campos.
2. ⏳ **PREPARADA — `docs/normativa/`.** No se pudieron incorporar los PDF:
   el proxy de egreso del entorno bloquea `bcp.gov.py`, `mic.gov.py`,
   `acraiz.gov.py` y `silpy.congreso.gov.py` (los cuatro comprobados). En su
   lugar se creó **`docs/normativa/INDICE.md`** con lo que hay, lo que falta
   —separado en prioridad A (normas que el código ya cita y cuyo texto no
   está, empezando por la **215/2017**) y prioridad B (las que el criterio
   unificado incorpora)— y la dirección oficial de cada una. Las descarga
   una persona desde una red común.
3. ✅ **APLICADA — correo inventado.** Se retiró de las dos aclaraciones que
   lo publicaban (consultas y reclamos, y aviso de privacidad). Los canales
   de atención ahora se derivan de `contactosInstitucionales()` y **omiten lo
   que no existe** (D-19); el aviso de privacidad usa
   `CORREO_RETRACTO_Y_DATOS`, que es el único correo que la matriz da por
   cerrado y exactamente para ese uso. El documento de reclamos pasó a ser
   una función porque su contenido depende de qué contactos estén cargados.
4. 👤 **Compuertas de producción — sumar a la §8 de la matriz:** (a) marco
   MGCTI de Alianza (Res. 219/2018) cubriendo evaluación de riesgos del
   canal, gobernanza y planes de contingencia aprobados por Directorio
   (210/2025 arts. 2.c, 2.d y 10); (b) contrato AAB1↔Interseguros con el
   reparto de responsabilidad del art. 8; (c) en la §8.5, que el certificado
   cualificado de Interseguros en Code100 sea el de **Rodrigo Fernández
   Echazú (mat. 2918)** y que el contrato con Code100 documente el servicio
   (cualificado/no cualificado) por firmante; (d) en la §8.7, comercio
   receptor Bancard = **Alianza** (Ley 7503/2025).
5. 👤 **Dos consultas jurídicas a Alianza/Legal**, registradas junto a D1:
   quién ejecuta la firma simple del cliente (art. 4 la respalda) y la
   lectura de la exigibilidad de la prima frente al CPC (§5.2). El diseño
   actual soporta ambas respuestas sin reescritura.
6. ✅ **APLICADA — L6 con etiqueta normativa.** `PLAN_DE_CAMBIOS_v2.md` lleva
   ahora una tabla que asocia cada ítem pendiente de L6 con el artículo que
   lo exige y la fila de la matriz que lo respalda (TRV-01 y CMP-14 → art. 9;
   CMP-10 → art. 7(a-d); CMP-12/13, CMP-16 y rate limiting → art. 2(e)), con
   la consecuencia dicha sin rodeos: mientras L6 no esté, el portal no
   cumple los arts. 2(e), 7 y 9 de la norma que habilita la venta
   electrónica.
7. 👤 **D-19 con dos normas esperando** (210/2025 art. 7.a + 030/2025):
   conseguir teléfono y correos de atención reales deja de ser cosmético. La
   pantalla ya está preparada para mostrarlos apenas existan, sin tocar
   código: se configuran por variables `NEXT_PUBLIC_*`.
8. 👤 **Calendario regulatorio:** renovación de matrícula de Interseguros
   antes del **18-sep-2027** bajo el régimen 031/2026 + 117/2026, y aviso de
   Alianza a la SIS ≥ 10 días hábiles antes de comercializar por el canal
   (231/2025). No toca código; anotarlo donde el negocio siga vencimientos.
9. ✅ **APLICADA — higiene de citas.**
   `src/domain/__tests__/higiene-de-citas.test.ts` pone la suite en rojo si
   alguna norma derogada (Ley 4017/2010, 4610/2012, Res. 136/2018, 292/2007,
   022/2024, 303/2024), la errata «215/15» o un dato de contacto inventado
   reaparecen en `src/` o en la matriz de cumplimiento. No valida que la cita
   sea *pertinente* —eso exige leer la norma—, solo impide las que ya sabemos
   equivocadas. No revisa el resto de `docs/`: los documentos de auditoría
   nombran las normas derogadas justamente para advertir que no se citen.

---

## 9. Tercer documento: memo «Marco Regulatorio de Firma Electrónica» (v3)

**Naturaleza:** memo jurídico-técnico (6 páginas) sobre el mecanismo de firma
del cliente bajo la Ley 6822/2021 y la Res. 210/2025. Es el documento que
**cierra la dirección técnica de D1**: SeguroLoTengo implementa internamente
la firma electrónica no cualificada (FENC) del cliente — la 210/2025 no exige
prestador registrado, exige autenticación y evidencia, y el portal ya produce
las dos cosas. Code100 queda solo para las firmas cualificadas
institucionales. El criterio operativo completo y el mapa de mecanismos de
seguridad están en `docs/CRITERIO_UNIFICADO_NORMATIVA_Y_SEGURIDAD.md`; acá
quedan las **aclaraciones que modifica** sobre lo dicho en §2–§8:

### 9.1 Aclaración sobre D-07 y la regla inviolable #1 (modifica lo dicho en §2, art. 4)

D-07 retiró el OTP de firma del portal suponiendo que el acto ocurría dentro
del flujo de Code100. Con C1 (Code100 no puede recibir la firma del cliente)
y este memo, la dirección es la inversa: **el OTP del acto de firma vuelve a
ser un acto propio del portal, distinto del OTP de canal aunque viaje al
mismo WhatsApp**. Cuando D1 se formalice, D-07 y la regla inviolable #1 se
re-redactan; hasta entonces no se implementa nada (las decisiones PENDIENTES
no se implementan). El análisis del art. 4 en §2 sigue siendo válido: el
esquema autenticación + integridad + trazabilidad es el mismo; cambia quién
emite el OTP del acto.

### 9.2 Aclaración sobre el registro ante el MIC (tema nuevo, no cubierto en §2–§7)

El memo trae dos posiciones en tensión: su primera sección afirma que operar
el software de firmas en AWS convierte a Interseguros en **prestador de
servicios de confianza no cualificado** con inscripción obligatoria en el
REPSE; su complemento lo refina con la letra de la Ley 6822/2021 (servicio de
confianza = prestado *habitualmente a cambio de remuneración*): un mecanismo
**interno, gratuito y exclusivo** de las propias contrataciones no es un
servicio de confianza y **no requiere registro**. Criterio adoptado: el del
complemento, **más una consulta escrita al MIC antes de producción** para
convertir la interpretación en certeza. Si alguna condición cambia (cobrar
por la firma, ofrecerla a terceros, publicitarla, emitir certificados),
corresponde la comunicación FOR-ICPP-02 dentro de los tres meses.

### 9.3 Aclaración sobre la 231/2025 (amplía §7 tema 4)

Dos precisiones que el análisis anterior no tenía: la 231/2025 **prohíbe las
firmas facsimilares o imágenes digitalizadas** en la póliza (refuerza que las
institucionales sean cualificadas de verdad, nunca un sello gráfico), y exige
que la aseguradora **notifique a la SIS con al menos 10 días hábiles de
anticipación** el inicio de la comercialización por el canal no presencial.
Ese trámite es de Alianza — va al calendario regulatorio junto a la
renovación de matrícula (§8.8).

### 9.4 Aclaración sobre el texto del acto de firma (modifica la Matriz §4)

El memo fija los textos del acto: botón *«Firmar electrónicamente la
Solicitud y el FIPF»* y declaración que nombra el código de un solo uso al
WhatsApp verificado — **sin nombrar proveedor ni presentarse como
prestador**. El texto actual de la Matriz V4 §4 («…deseo firmarlo mediante
Code100») contradice esa regla y la de CLAUDE.md («ninguna pantalla nombra al
proveedor»); al implementar D1 el texto se corrige y el cambio se registra en
la matriz (su propia regla de control lo exige). Se suma a la lista de
divergencias declaradas junto a ALR-06/ALR-07.

### 9.5 Evidencia por firma (confirma §2 art. 9 y precisa TRV-01)

La lista de ~20 datos por acto de firma que el memo exige está cubierta casi
entera por `RegistroEvidencia` + `DecisionBiometrica` + los hashes del
paquete. Lo que falta cae en TRV-01/L6 (descargas como evento) y en dos
refuerzos de Go-Live: los **tres timestamps del OTP de firma** como eventos
propios (al implementar D1) y el **sellado criptográfico de la constancia de
evidencias** (firma asimétrica con AWS KMS). Detalle en el checklist §3 del
criterio unificado.
