# Mapa de porteo: repo-diseno (Lovable) → segurolotengo-demo (Next.js)

Este documento es para **Claude Code trabajando en `segurolotengo-demo`**. Dice
de dónde sale cada cosa en el prototipo de Lovable y a dónde va en el producto,
y —sobre todo— **con qué método**, porque el método es lo que falló la última
vez (ver `docs/BITACORA.md`, entradas del 01-sep-2026 (c) y (d)).

## 0. La lección del canvas: portar el armazón, no las diferencias

La importación del canvas de Claude Design se hizo al principio «por
diferencias»: se miraba la pantalla propia, se comparaba con el diseño, se
corregía lo señalado, y a la ronda siguiente aparecían más diferencias, porque
**el armazón seguía siendo el propio**. Andres lo resumió así: «COMO TENGO QUE
DECIRTE QUE SE RESPETE PRIMERO EL DISEÑO».

Regla para este porteo, sin excepción:

1. **La estructura JSX de la pantalla se toma del prototipo de Lovable**, no
   del componente existente. Se lee `src/pages/<Pantalla>.tsx` del prototipo,
   se copia su árbol de secciones y su orden, y **sobre ese árbol** se cuelgan
   los datos y las llamadas del producto.
2. **El CSS se porta tal cual**, encapsulado. Igual que `canvas-v3.css`: los
   tokens y las clases de componente del prototipo entran en un archivo
   propio (`src/app/lovable-v4.css`, por ejemplo) colgado de
   `[data-flujo="v3"]` o del selector que corresponda, **sin traducir a
   utilidades de Tailwind a mano**. Traducir es reinterpretar.
3. **Los componentes shadcn del prototipo no se instalan** en el producto. Se
   lee qué dibujan (su CSS computado y su HTML) y se reproduce en el
   componente compartido equivalente de `src/components/shared/`. shadcn es
   una dependencia de diseño, no del producto.
4. **La lógica no se toca.** Todo lo que en el prototipo es `useState`
   simulado, en el producto ya existe y viene de `src/domain/` y de los Route
   Handlers. La pantalla nueva llama a lo mismo que llamaba la vieja.
5. **Una pantalla por sesión de Claude Code** (regla de `CLAUDE.md`). Antes,
   una sesión solo para tokens y cascarón.

## 1. Correspondencia de archivos

| Prototipo Lovable (`repo-diseno`)                | Producto (`segurolotengo-demo`)                                            | Cómo                                                                                   |
| :----------------------------------------------- | :------------------------------------------------------------------------- | :------------------------------------------------------------------------------------- |
| `src/index.css` — tokens `@theme`, `:root`, `[data-tema]`, `[data-flujo]` | `src/app/globals.css`                                             | **Diff de valores** sobre los mismos nombres. Un token nuevo se agrega con comentario de origen. |
| `src/index.css` — clases de componente (`.btn`, `.card`, …)               | `src/app/lovable-v4.css` (nuevo), importado en `layout.tsx` después de `canvas-v3.css` | Copia literal, prefijada con `[data-flujo="v3"]`. Se retira `canvas-v3.css` recién cuando ninguna pantalla lo use. |
| `src/components/shared/HeaderInstitucional.tsx`  | `src/components/shared/HeaderInstitucional.tsx`                            | Reproducir estructura y clases; conservar `ToggleTema` y `marcas.tsx` (isologos inline). |
| `src/components/shared/BandaPasos.tsx`           | `src/components/shared/BandaPasosV3.tsx`                                   | Reproducir dibujo; conservar que recibe **slug** y deriva el número de `PASOS_FLUJO`. |
| `src/components/shared/BarraPlan.tsx`            | `src/components/shared/BarraPlanSeleccionado.tsx` / `BarraPlanDelExpediente.tsx` | Reproducir dibujo; los datos siguen viniendo del expediente. |
| `src/components/shared/CamposOtp.tsx`            | `src/components/shared/CamposOtp.tsx`                                      | Reproducir dibujo. **Nunca** mostrar el código (regla inviolable #2). |
| `src/components/shared/AceptacionAgrupada.tsx`   | Bloques de aceptación en `Inscripcion.tsx`, `FormularioSeguroP2.tsx`, `FirmaInternaV3.tsx` | Extraer a un compartido si el prototipo lo unificó; la evidencia con versión de texto no cambia. |
| `src/components/shared/AvisoCtaFlotante.tsx`     | `src/components/shared/AvisoCtaFlotante.tsx`                               | Reproducir dibujo; conservar el mecanismo `data-cta`. |
| `src/components/shared/PieLegal.tsx`             | `src/components/shared/PieLegal.tsx`                                       | Reproducir dibujo; los textos ya salen de `src/domain/textos-legales.ts`. |
| `src/components/shared/AclaracionModal.tsx`      | `src/components/shared/AclaracionModal.tsx`                                | Reproducir dibujo; contenido de `textos-aclaraciones.ts`. |
| `src/components/shared/ModalVisorPdf.tsx`        | `src/app/(flujo)/firma/ModalVisorPdf.tsx`                                  | Reproducir dibujo. |
| `src/components/shared/ModalBancard.tsx`         | `src/app/(flujo)/pago/ModalBancard.tsx` + `VentanaBancardSimulada.tsx`     | Reproducir dibujo. **La guarda de la regla #6** (`no-persiste-datos-de-tarjeta.test.ts`) tiene que seguir en verde: los campos de tarjeta no salen del navegador. |
| `src/pages/Inicio.tsx`                           | `src/app/page.tsx` + `src/app/InicioV3.tsx`                                | Armazón del prototipo; la aceptación de T&C sigue creando el expediente (DI-10). |
| `src/pages/Inscripcion.tsx`                      | `src/app/(flujo)/inscripcion/Inscripcion.tsx` + `identidad/VerificacionIdentidad.tsx` (prop `canvas`) | Armazón del prototipo. **`VerificacionIdentidad` es compartida con v2**: los cambios de v3 van detrás de la prop `canvas` (Bitácora 01-sep (g)). |
| `src/pages/Seguro.tsx`                           | `src/app/(flujo)/seguro/Seguro.tsx` + `FormularioSeguroP2.tsx` + `plan/SelectorDePlanes.tsx` (prop `canvas`) | Armazón del prototipo; `role="radio"` + `aria-checked` se conservan (e2e v2 dependen). |
| `src/pages/PagoYFirma.tsx`                       | `src/app/(flujo)/pago-y-firma/PagoYFirma.tsx` + `FirmaInternaV3.tsx` + `pago/FormularioPagoP7.tsx` | Armazón del prototipo; el orden firma → pago y el gating por `FIRMADO` no se tocan (regla 6-bis). |
| `src/pages/Confirmacion.tsx`                     | `src/app/(flujo)/confirmacion/ContratacionAceptada.tsx`                   | Armazón del prototipo; los tres descargables y la tarjeta de estado de la póliza (D-05). |
| `src/pages/RevisionManual.tsx`                   | `src/app/revision-manual/page.tsx` + `ResumenDelCaso.tsx`                 | Armazón del prototipo; **se conserva** el detalle operativo que el prototipo no modela (número de caso, estado, qué se envió). |
| `public/marca/*.svg`, `public/v3/*.jpg`          | mismos archivos                                                            | No se copian de vuelta: el prototipo los tomó del producto. Si Lovable generó imágenes nuevas, entran a `public/v4/` y se registra en `GUIA_DE_ESTILOS.md`. |

## 2. Qué NO se porta nunca

- Textos que estén en el prototipo y **no** en `ESPECIFICACION_PANTALLAS.md`
  ni en `src/domain/textos-*.ts`. Se reportan como divergencia, no se copian.
- Campos de formulario que el prototipo haya agregado (pasa: ver la cédula
  del beneficiario en la Bitácora del 01-sep (b)).
- Datos de contacto, resoluciones o matrículas que aparezcan escritos en el
  prototipo: `higiene-de-citas.test.ts` pone la suite en rojo.
- Dependencias: shadcn/ui, Radix, lucide, framer-motion, o cualquier paquete
  que el prototipo traiga. Si un ícono del prototipo hace falta, se copia el
  SVG inline (`IlustracionCaptura.tsx` es el precedente).
- `localStorage` fuera de la preferencia de tema.

## 3. Método de verificación (repetible, no a ojo)

Antes de dar por portada una pantalla, en este orden:

1. **Textos contra el código fuente**, no contra el DOM renderizado (lección
   de la Bitácora 01-sep (f): el `innerText` sub-reporta lo que está en
   desplegables cerrados y en secciones todavía bloqueadas). Extraer los
   textos visibles del `src/pages/<Pantalla>.tsx` del prototipo y buscarlos
   en el código del producto; cada candidato faltante se verifica a mano.
2. **Capturas lado a lado**: `CAPTURAS_DISENO=./capturas-v4 npm run test:e2e:v3`
   genera una captura de página completa y un volcado de texto por pantalla
   (`e2e/v3/04-camino-feliz.spec.ts`). Se compara contra la vista previa del
   prototipo a la misma anchura (360 y 1400).
3. **La suite entera**: `npm run verify`. En particular `copys-voseo`,
   `higiene-de-citas`, `no-persiste-datos-de-tarjeta`, `rutas-flujo` y los
   tres tests del stepper.
4. **E2E de los dos flujos**: `npm run test:e2e:v3` **y** `npm run test:e2e`
   (v2 es producción con el flag apagado; la Bitácora 01-sep (g) registra
   cómo se rompió sin querer).

## 4. Ramas, flag y despliegue

- Rama por pantalla: `feat/rediseno-lovable-00-tokens`,
  `feat/rediseno-lovable-01-inicio`, … `-06-revision-manual`.
- Todo detrás de `FLUJO_V3`, como hasta ahora. `main` sigue desplegando v2 con
  el flag apagado; el rediseño se ve en el entorno donde el flag esté en
  `true`.
- Cadena de `docs/POLITICA_DE_DESPLIEGUE.md` en cada rama: `npm run verify` →
  `npm run seguridad` → PR a `main` → 4 jobs de CI en verde → merge.
- Cada sesión deja su entrada en `docs/BITACORA.md` con la referencia al
  commit/tag del prototipo del que se portó (`diseno-v1-aprobado` en
  `repo-diseno`).
