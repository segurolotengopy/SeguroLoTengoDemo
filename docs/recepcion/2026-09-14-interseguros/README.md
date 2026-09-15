# Recepción de definiciones · 14-sep-2026

Carpeta **transitoria**. Acá se deja, tal como llega, lo que Rodrigo Fernández
(Interseguros) envía durante el 14-sep-2026. Se lee, se contrasta contra el
repositorio y **recién después** cada archivo se muda a su lugar definitivo, con
un commit propio y su entrada en la Bitácora. Cuando la carpeta queda vacía, se
borra.

**No renombres nada al dejarlo.** El nombre original es parte de la evidencia de
qué se recibió; el nombre definitivo se decide al mudarlo, según la convención
de la carpeta de destino.

## Cómo retomar en una sesión nueva

1. **¿Ya se fusionó el PR #115?** (`gh pr view 115`). Esta carpeta y la entrada
   del 14-sep de la bitácora entran a `main` con ese PR.
   - **Fusionado:** partí de `main` y abrí una rama nueva, por ejemplo
     `docs/recepcion-rodrigo-14-sep`.
   - **Abierto:** trabajá sobre su rama, en un worktree propio:

     ```bash
     git worktree add .claude/worktrees/recepcion-rodrigo claude/alianza-garantia-integration-9febfc
     ```
2. **Copiá lo que mandó Rodrigo desde Descargas, sin renombrar**, cada cosa a
   su carpeta. Las pantallas v4, si llegan como carpeta, van enteras (`cp -r`):

   ```bash
   cp "$HOME/Descargas/<modelo de CPC>.pdf" docs/recepcion/2026-09-14-interseguros/01-alianza-aprobados/
   cp -r "$HOME/Descargas/<carpeta v4>" docs/recepcion/2026-09-14-interseguros/02-pantallas-v4/
   cp "$HOME/Descargas/<PDF de legal>.pdf" docs/recepcion/2026-09-14-interseguros/03-legal/
   ```
3. Pedile a la sesión que **contraste cada documento** con la sección «Qué se
   verifica» de abajo y que responda P0–P7. Recién después se mudan a su lugar
   definitivo y se enmiendan D-10, D-12 y D-13.
4. **El correo a Alianza** está en `BORRADOR_CORREO_ALIANZA.md`, sin enviar:
   espera P1 y la fecha de las IP.

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

**Estado al 15-sep-2026**, con el handoff de pantallas v4 y el manual funcional
(`02-pantallas-v4/ANALISIS.md`) y las decisiones D-28 a D-41 de Andres:

| # | Estado |
| :-- | :-- |
| P0 | **Resuelta.** v4 tiene 5 etapas con el plan primero y portada. El v3 de Lovable queda superado (D-28, D-36). |
| P1 | **Contradicha.** El manual (p. 9) pone a Alianza como firmante cualificada de la Solicitud + FIPF, contra el WhatsApp de Rodrigo. Se le vuelve a preguntar (C-4). |
| P2 | Abierta. |
| P3 | **Resuelta** (D-31): se editan y se registra el cambio, pero la elegibilidad y el bloqueo se calculan con el OCR. |
| P4 | El manual no tiene retracto. Choca con la fila 64; va a Legal (C-7). |
| P5 | **Resuelta** en pantalla (D-33): 3 preguntas médicas y la PEP en 03E. Sigue abierto si `Solicitud.pdf` es el modelo inscripto. |
| P6 | Abierta. |
| P7 | El manual adopta Google Analytics sin opción de rechazo. D-34 excluye los datos sensibles; la fila 85 sigue con Legal (C-2). |

Ya respondido (Rodrigo, 14-sep-2026, WhatsApp): **el CPC lo emite Interseguros
desde SeguroLoTengo y lo firma Alianza**, con dos precondiciones —firma no
cualificada del cliente sobre la Solicitud + FIPF y pago acreditado—, y **el
modelo de CPC lo manda Alianza aprobado**. Deja sin efecto la parte de la
enmienda del 04-sep a D-12 según la cual Alianza lo emitía «desde su sistema».
