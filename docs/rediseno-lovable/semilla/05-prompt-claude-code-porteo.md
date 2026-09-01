# Plantilla de prompt para cada sesión de porteo en Claude Code

Se abre **una sesión de Claude Code por pantalla** en `segurolotengo-demo`,
con el prototipo aprobado disponible de una de estas dos formas (las dos
sirven; la primera es más cómoda para leer en volumen):

- clonado **en solo lectura** como carpeta hermana:
  `git clone --branch main <url-repo-diseno> ../slt-diseno-lovable && git -C ../slt-diseno-lovable checkout diseno-v1-aprobado`
- o accesible por el MCP de Lovable (`/mcp` tiene que mostrar `lovable` conectado).

Reemplazar lo que va entre `<>`.

---

## Sesión 0 · Tokens y cascarón

```
Leé docs/BITACORA.md (entrada más reciente y su «Queda abierto»), CLAUDE.md
y docs/rediseno-lovable/semilla/04-mapa-porteo.md. Después leé
docs/rediseno-lovable/GUIA_REDISENO_LOVABLE.md §5.

Tarea de esta sesión: portar SOLO los tokens y el cascarón compartido del
prototipo aprobado de Lovable (etiqueta `diseno-v1-aprobado`, clonado en
../slt-diseno-lovable). No toques ninguna pantalla todavía.

1. Diff de `../slt-diseno-lovable/src/index.css` contra `src/app/globals.css`:
   aplicá los cambios de VALOR sobre los tokens existentes; todo token nuevo
   entra con un comentario `/* Lovable v4: <motivo> */`.
2. Las clases de componente del prototipo van a `src/app/lovable-v4.css`,
   copiadas tal cual y prefijadas con `[data-flujo="v3"]`, importado en
   `src/app/layout.tsx` después de `canvas-v3.css`.
3. Reproducí en `src/components/shared/` el dibujo de HeaderInstitucional,
   BandaPasosV3, PieLegal, AvisoCtaFlotante y CamposOtp del prototipo,
   conservando su lógica actual (slug → número de paso, ToggleTema, marcas
   inline, data-cta). Sin instalar dependencias nuevas.
4. Actualizá /design-system para que muestre los tokens nuevos.
5. `npm run verify`, `npm run test:e2e:v3` y `npm run test:e2e` (v2 es
   producción: tiene que quedar idéntica con el flag apagado).
6. Entrada en docs/BITACORA.md con el caso, qué cambió, verificaciones con
   números y qué quedó abierto. Rama: feat/rediseno-lovable-00-tokens.

Si algo del prototipo contradice CLAUDE.md, GUIA_DE_ESTILOS.md o la matriz
de cumplimiento, avisame antes de implementarlo.
```

## Sesión N · Una pantalla

```
Leé docs/BITACORA.md (entrada más reciente), CLAUDE.md,
docs/rediseno-lovable/semilla/04-mapa-porteo.md §0 y la sección
«<Nombre de la pantalla>» de docs/ESPECIFICACION_PANTALLAS.md.

Tarea de esta sesión: portar la pantalla <ruta> desde el prototipo aprobado
de Lovable (`../slt-diseno-lovable/src/pages/<Archivo>.tsx`, etiqueta
`diseno-v1-aprobado`). Método obligatorio: **el armazón JSX se toma del
prototipo y sobre él se cuelgan los datos y llamadas que ya tiene el
producto**. No trabajes por diferencias contra la pantalla actual.

1. Leé completo el archivo del prototipo y sus componentes hijos. Listame
   su árbol de secciones antes de escribir código.
2. Reescribí <archivos del producto según el mapa de porteo> con ese árbol.
   La lógica (llamadas a /api/*, estados del expediente, evidencias, gating
   por estado) es la que ya existe; no la cambies. Los cambios visuales de
   v3 van detrás de la prop `canvas` si el componente es compartido con v2.
3. Textos: SOLO los de docs/ESPECIFICACION_PANTALLAS.md y src/domain/textos-*.ts.
   Si el prototipo trae un texto que no está ahí, no lo copies: reportalo en
   la sección «Divergencias» de la Bitácora.
4. Verificación repetible: (a) extraé los textos del archivo del prototipo y
   buscá cada uno en el código fuente del producto, verificando a mano cada
   faltante; (b) `CAPTURAS_DISENO=./capturas-v4 npm run test:e2e:v3` y
   compará la captura con la vista previa del prototipo a 360 y 1400 px;
   (c) `npm run verify`; (d) `npm run test:e2e` (v2 intacta).
5. Entrada en docs/BITACORA.md. Rama: feat/rediseno-lovable-<NN>-<slug>.

No instales dependencias. No toques src/domain/ salvo que un texto nuevo
aprobado deba entrar a un textos-*.ts, y en ese caso decímelo primero.
```

## Cierre · después de la última pantalla

```
Leé docs/BITACORA.md. Tarea: cerrar el rediseño Lovable v4.
1. Verificá que ninguna pantalla de v3 use ya clases de canvas-v3.css; si
   es así, retiralo y dejá lovable-v4.css como única piel.
2. Actualizá docs/GUIA_DE_ESTILOS.md: nueva sección «Rediseño v4 (Lovable,
   <fecha>)» con la fuente (repo-diseno, etiqueta diseno-v1-aprobado), los
   tokens que cambiaron de valor y los nuevos.
3. Actualizá CLAUDE.md → «Convenciones de UI» con la referencia al prototipo
   como fuente visual del flujo v3.
4. npm run verify, e2e v3 y v2, entrada de Bitácora, PR.
```
