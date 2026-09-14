# Recepción de definiciones · 14-sep-2026

Carpeta **transitoria**. Acá se deja, tal como llega, lo que Rodrigo Fernández
(Interseguros) envía durante el 14-sep-2026. Se lee, se contrasta contra el
repositorio y **recién después** cada archivo se muda a su lugar definitivo, con
un commit propio y su entrada en la Bitácora. Cuando la carpeta queda vacía, se
borra.

**No renombres nada al dejarlo.** El nombre original es parte de la evidencia de
qué se recibió; el nombre definitivo se decide al mudarlo, según la convención
de la carpeta de destino.

## Dónde va cada cosa

| Carpeta | Qué se deja | Destino definitivo (tentativo) |
| :-- | :-- | :-- |
| `00-ya-recibido/` | Lo que ya llegó antes de abrir esta carpeta: la *Definición funcional definitiva* del 07-sep (copiada de Descargas) | `docs/plan/` o `docs/antecedentes/`, según lo que diga el PDF de legal |
| `01-alianza-aprobados/` | Documentos aprobados por Alianza. **El modelo de CPC aprobado** (Rodrigo: «hoy manda Alianza el CPC aprobado») y cualquier otro modelo: Solicitud, FIPF, póliza | `docs/` (junto a `Solicitud.pdf` y `FIPF.pdf`) o `docs/RegistrosOficiales/` |
| `02-pantallas-v4/` | Versión 4 de las pantallas: HTML o JSON, **la secuencia**, los estilos y el sistema de diseño. Si llega como carpeta exportada, dejala entera, con su estructura | `docs/rediseno-v4/` (reemplaza como fuente visual al prototipo v3 de Lovable, si así se decide) |
| `03-legal/` | El PDF nuevo con las últimas definiciones de legal | `docs/plan/` + enmiendas en `DECISIONES.md` |

## Qué no entra nunca

- **Datos personales reales.** El TXT de ejemplo de vida colectivo trae nombres
  y cédulas de personas reales: se analiza desde `~/Descargas` y no se copia
  acá. El `.gitignore` de esta carpeta excluye los `.txt`.
- **Credenciales.** IP, usuario, contraseña o llave del SFTP de Alianza van a
  Secrets Manager. El `.gitignore` también excluye llaves.

## Qué se verifica al recibir cada documento

### Modelo de CPC aprobado (01)

Contrastarlo con lo que genera hoy `src/domain/certificado-cobertura.ts` y
`src/documentos/plantillas.ts`:

- Campos y orden: asegurado, plan, coberturas y sumas, premio, **inicio de
  cobertura = cobro acreditado + 24 h** (CHG-41), fin de vigencia, carencias.
- Quién figura como emisor y cómo se identifica a Interseguros (corredor,
  matrícula SIS 118). Rodrigo, 14-sep: *«nosotros emitimos el CPC, que es lo
  que firma Alianza»*; hay que ver cómo lo dice el texto aprobado.
- Si prevé **firma visible** de Alianza, y dónde: define el layout y el
  firmador por carpetas.
- Si admite el **QR de verificación** y la leyenda «no es la póliza».
- Precondiciones que confirma: firma no cualificada del cliente + pago
  acreditado. **No** la firma de Interseguros.

### Pantallas v4 (02)

- **Secuencia** contra la §13 de la definición del 07-sep (8 pasos, plan
  primero) y contra `PASOS_FLUJO_V2` / `PASOS_FLUJO_V3` de
  `src/domain/rutas-flujo.ts`. El v3 de Lovable tiene 3 pasos con la identidad
  primero: si v4 confirma los 8 pasos, v3 queda superado.
- **Textos** contra las §8 (consentimientos) y §9 (textos informativos) del
  07-sep, palabra por palabra.
- **Campos** contra el inventario cerrado de la §4 y los catálogos de la §5.
- **Estilos y tokens** contra `docs/GUIA_DE_ESTILOS.md` y
  `src/app/lovable-v4.css`.
- Lo que v4 traiga de más, o de menos, se reporta como divergencia, no se
  copia en silencio (misma regla que con el prototipo v3).

### PDF de legal (03)

Contrastarlo con la definición del 07-sep, con `docs/plan/DECISIONES.md` y con
la matriz (CSV + `MATRIZ_LEGAL_V4.md`), y ver si responde las preguntas de
abajo.

## Preguntas abiertas que estos documentos deberían cerrar

Enviadas a Rodrigo el 14-sep-2026, salvo la P0, que es de Andres.

| # | Pregunta | Qué decisión mueve |
| :-- | :-- | :-- |
| P0 | ¿v4 confirma la secuencia de 8 pasos con el plan primero? ¿Se abandona el v3 de 3 pasos? | Porteo v3, `rutas-flujo.ts` |
| P1 | ¿Alianza firma solo el CPC, o también la Solicitud + FIPF (tabla §11 del 07-sep)? | D-13 |
| P2 | Si la firma de Alianza no llega (firmador caído), ¿qué recibe el cliente? | D-12, pantalla de confirmación |
| P3 | ¿Cédula y fecha de nacimiento dejan de ser editables? (reglas inviolables #8 y #11) | Paso 4 |
| P4 | ¿Se elimina el retracto pese a la fila 64 de la matriz? | `/retracto`, `PieLegal` |
| P5 | ¿El PDF imprime las 3 preguntas médicas + PEP, o las 8 del formulario de Alianza? ¿`Solicitud.pdf` es el modelo inscripto bajo 15-VI.0002? | Mapa 5→8, `documentos.ts` |
| P6 | ¿Cuáles son los «campos 31 a 35» eliminados? | Inventario de campos |
| P7 | ¿Legal validó el aviso de cookies de Google Analytics sin aceptar ni rechazar? | Integraciones, fila 85 |

Ya respondido (Rodrigo, 14-sep-2026, WhatsApp): **el CPC lo emite Interseguros
desde SeguroLoTengo y lo firma Alianza**, con dos precondiciones —firma no
cualificada del cliente sobre la Solicitud + FIPF y pago acreditado—, y **el
modelo de CPC lo manda Alianza aprobado**. Deja sin efecto la parte de la
enmienda del 04-sep a D-12 según la cual Alianza lo emitía «desde su sistema».
