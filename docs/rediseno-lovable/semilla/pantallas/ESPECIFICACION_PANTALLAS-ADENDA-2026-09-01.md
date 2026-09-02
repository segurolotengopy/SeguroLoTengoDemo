# Adenda a `docs/ESPECIFICACION_PANTALLAS.md` — 01-sep-2026

**Motivo:** al implementar el prompt P0 en Lovable, el agente reportó dos
vacíos de la especificación (sin inventar nada, como se le pidió). Los dos se
resuelven con el **texto literal del canvas aprobado** (Artifact ce0c8332), y
esta adenda los fija para que la especificación vuelva a ser suficiente por sí
sola. Se integra a la especificación en la próxima sesión de Claude Code
(sección «Elementos comunes» e «Inicio»); mientras tanto **rige junto con ella**.

También corrige la sección «Paleta y tipografía» de «Elementos comunes», que
hoy dice «como hasta ahora» y no aclara que el canvas es la fuente del dibujo.

---

## A. Pie legal — redacción literal (observación 1 de Lovable)

Reemplaza en «Elementos comunes» la descripción del bloque `INFORMACIÓN LEGAL
Y REGULATORIA` por el texto exacto. Rótulo del desplegable:
`INFORMACIÓN LEGAL Y REGULATORIA ▾` (abierto: `▴`). Cuerpo:

> SeguroLoTengo.com es marca y canal digital de Interseguros S.A. — Corredores
> de Seguros. La aseguradora es Alianza Garantía Seguros y Reaseguros S.A.
> Producto inscrito: Seguro de Vida Oncológico CONFÍO, SIS-VID-ONC-001/2026 ·
> Res. SS.SG. N° 250/2026. Firma electrónica del cliente: simple, autenticada
> por código de un solo uso; las firmas institucionales son cualificadas.
> Pagos procesados por Bancard directamente a favor de la aseguradora. La
> cobertura comienza 24 horas después del pago confirmado, una vez completada
> la contratación.

Estado del texto: **provisional** (pendiente de Legal, L6 —
`docs/plan/PROPUESTAS_TEXTOS_LEGALES_L6.md`); los identificadores
`SIS-VID-ONC-001/2026` y `Res. SS.SG. N° 250/2026` son marcadores DI-4 y se
muestran con el sufijo `(provisional)`. En el producto vive en
`src/domain/textos-legales.ts` (`IDENTIFICACION_CANAL`) con versión.

**Los siete enlaces no tienen URL**: abren el modal de aclaraciones
(`AclaracionModal`) sin abandonar la pantalla. En el prototipo de Lovable, el
modal muestra el contenido de la tabla siguiente, tomado del canvas y rotulado
`TEXTO DE MUESTRA` en el pie del modal (el canvas ya lo rotula así). En el
producto, el contenido sale de `src/domain/textos-aclaraciones.ts`, que manda
sobre esta tabla cuando difieran.

| Enlace | Título del modal | Meta | Secciones (título — texto) |
| :--- | :--- | :--- | :--- |
| Términos y condiciones | Términos y condiciones de uso de SeguroLoTengo.com | Versión 4.0 · vigente desde agosto de 2026 | QUIÉN OPERA EL SITIO — SeguroLoTengo.com es marca y canal digital de Interseguros S.A. — Corredores de Seguros. Los seguros ofrecidos son emitidos por Alianza Garantía Seguros y Reaseguros S.A. · USO PERSONAL — La contratación es únicamente a nombre propio, con cédula de identidad paraguaya vigente, y requiere ser mayor de 18 años y menor de 65 al momento del ingreso. · CANALES VERIFICADOS — El WhatsApp y el correo declarados se verifican con un código de un solo uso y se utilizan para entregar documentos y notificaciones. Ningún operador solicita ese código por llamada. · FIRMA ELECTRÓNICA — La firma del cliente es electrónica simple autenticada por código de un solo uso. Las firmas de Interseguros y Alianza son cualificadas. · PAGOS — Los pagos se procesan por Bancard a favor de la aseguradora. El portal no almacena datos de tarjetas. |
| Aviso de privacidad | Aviso de privacidad y tratamiento de datos | Versión 4.0 · responsables: Interseguros S.A. y Alianza Garantía | DATOS QUE TRATAMOS — Datos de identificación extraídos de la cédula, imagen facial y prueba de vida, datos de contacto, laborales y de ingresos, declaraciones de salud y condición de persona expuesta políticamente. · PARA QUÉ — Validar identidad, evaluar el riesgo, emitir la póliza, prevenir fraude y cumplir obligaciones de la normativa de seguros y de prevención de lavado de activos y financiamiento del terrorismo. · CON QUIÉN SE COMPARTEN — Con la aseguradora, el proveedor de firma electrónica, el procesador de pagos Bancard y las autoridades que lo requieran conforme a la ley. · CONSERVACIÓN Y DERECHOS — Los datos se conservan por los plazos legales aplicables. Podés solicitar acceso, rectificación o supresión, y revocar los consentimientos opcionales, escribiendo a los canales de Interseguros. |
| Coberturas, exclusiones y carencias | Ver `canvas-modales.md` (`coberturas`) | — | Ver `canvas-modales.md`. |
| Condiciones generales | Ver `canvas-modales.md` (`condiciones`) | — | Ver `canvas-modales.md`. |
| Consultas y reclamos | Consultas y reclamos | Atención de Interseguros S.A. y Alianza Garantía | Ver `canvas-modales.md`. **Los datos de contacto (teléfonos, correos, horarios) NO se copian**: van como `[dato oficial pendiente]` (`higiene-de-citas.test.ts`). |
| Derecho de retracto | Ver `canvas-modales.md` (`retracto`) | — | Ver `canvas-modales.md`. |
| Verificación de documentos | Ver `canvas-modales.md` (`verificacion`) | — | Ver `canvas-modales.md`. |

Pie de todos los modales: `Texto de muestra para la demostración del flujo.`

## B. Cabecera — tercer bloque y referencias (observación 1, segunda parte)

Confirmado tal como Lovable lo hizo: las referencias regulatorias de la
cabecera se muestran **con el sufijo `(provisional)`** (DI-4). Texto literal
de los tres bloques, en este orden:

1. `ASEGURADORA` / `Alianza Garantía Seguros y Reaseguros S.A.` / `Res. SS.SG. N° 118/2003 · producto SIS-VID-ONC-001/2026 (provisional)` — el bloque enlaza a `https://alianzagarantia.com/#/home` (nueva pestaña).
2. `INTERMEDIARIO` / `Interseguros S.A. · Corredores de Seguros` / `Matrícula CS N° 0142 · Res. SS.SG. N° 072/2019 (provisional)` — enlaza a `https://interseguros360.com/`.
3. `CANAL DIGITAL` / `SeguroLoTengo.com` / `Marca de Interseguros S.A. · Res. SS.SG. N° 311/2026 (provisional)` — con el sello `SLT` (recuadro 38 × 38, borde 2 px `accent-600`, radio 12, texto acento 700). **Solo en el Inicio** (el canvas lo condiciona a `esInicio`); en los pasos, la cabecera tiene dos bloques. Enlaza a `https://www.segurolotengo.com`.

Botón de tema: `☾ Modo noche` / `☼ Modo día`, `.btn-ghost` 12 px, a la
derecha.

## C. Inicio — rótulo de la cuarta foto (observación 2 de Lovable)

Los cuatro rótulos del carrusel, en orden, con su foto:

| # | Foto | Rótulo (y `alt`) |
| :- | :--- | :--- |
| 1 | `hero-inscribite.jpg` | `Inscribite con nosotros` |
| 2 | `hero-seguro.jpg` | `Elegí tu seguro` |
| 3 | `hero-paga-firma.jpg` | `Pagá y firmá` |
| 4 | `hero-protege.jpg` | **`Protege a tu familia`** |

Cadencia: 3 s por foto (pedido de Andres del 01-sep; el canvas publicado usa
4,5 s), cruce de 0,7 s, cuatro puntos indicadores bajo el cuadro (acento el
activo, `neutral-400` los demás), recorte `center 40%`, cuadro `16/9` con radio
16. Alt de las fotos de paso: `Familia paraguaya reunida` (pasos 1–3) y
`Familia abrazándose junto a la póliza emitida` (confirmación).

## D. «Paleta y tipografía» — reemplazo del párrafo de «Elementos comunes»

> **Paleta, tipografía y dibujo:** los tokens son los de
> `docs/GUIA_DE_ESTILOS.md` (DM Sans, naranja/azul/verde/rojo/hueso,
> semánticos). **El dibujo de cada pantalla** —tamaños, radios, espaciados,
> rejillas, estados— es el del canvas aprobado «Seguro lo tengo: Flujo de 3
> pasos» (Artifact ce0c8332), tal como está en
> `docs/rediseno-lovable/semilla/canvas/` (`canvas-plantilla.html`,
> `canvas-estilos.css`, `canvas-reglas-visuales.md`). El canvas no usa
> Archivo, ni acento rojo, ni esquinas rectas: esos valores son la base
> «Modernist» que su propia capa de estilo redefine (ver
> `canvas-reglas-visuales.md` §1).

## E. Divergencias canvas ↔ especificación que se mantienen (sin cambio)

Para que nadie las «corrija» hacia el canvas:

- Beneficiario: el canvas pide cédula, fecha de nacimiento y celular; **no se
  piden** (DI-7, Res. SIS 215/2025 num. 11.4). Solo nombre, parentesco,
  domicilio.
- «Formulario de Información Previa a la Firma»: error del canvas; el FIPF
  es el Formulario de Identificación de Persona Física (DI-1).
- Datos de contacto, `CASO-2026-004518`, resoluciones: marcadores, nunca los
  del canvas.
- «La firma se realiza con el proveedor de firma electrónica»: en v3 la
  firma del cliente es interna (D1); el texto del canvas está desactualizado.
- Cadencia del carrusel: 3 s, no 4,5 s.
