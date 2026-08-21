# Decisión: el módulo de identidad se independiza de SeguroLoTengo

**Fecha:** 18 de agosto de 2026 · **Estado:** decidido; extracción pendiente (fase 1 sin empezar)
**Decisión de arquitectura/producto — sin fila en la matriz de cumplimiento.** Las obligaciones legales citadas abajo ya rigen hoy y no cambian por mover archivos.

## Qué se decide

El módulo de verificación de identidad de P5 —captura de documento, lectura MRZ/OCR, calidad de imagen, prueba de vida y comparación facial— pasa a ser un **paquete independiente y reutilizable** en otros proyectos (pedido explícito del 13-ago-2026). SeguroLoTengo lo consumirá como dependencia; ninguno de los dos conoce los internos del otro: se llaman solo a través del puerto `IdentityProvider`.

La migración es **en dos tiempos**: primero workspace npm dentro de este repo (para cortar dependencias con la suite en verde), después repositorio propio en `segurolotengopy`.

## El corte (verificado contra los imports reales, 18-ago-2026)

### Entra al paquete

| Archivo actual | Rol | Acoplamiento hoy |
| :---- | :---- | :---- |
| `src/domain/identidad-parametros.ts` | Umbrales y `VERSION_POLITICA_IDENTIDAD` | Ninguno |
| `src/domain/mrz.ts` | MRZ TD1 (ICAO Doc 9303) | Ninguno (pero hardcodea `PRY`, ver Parametrizaciones) |
| `src/domain/documento-regional.ts` | Qué documento se acepta, por marcadores impresos | Ninguno (catálogo PY/BO adentro) |
| `src/domain/calidad-captura.ts` | Calidad de imagen en cliente | Ninguno |
| `src/ports/identity-provider.ts` | El puerto: tipos de captura, `DecisionBiometrica`, unión `CapturaSelfie` | **Cero imports** — ya es la frontera |
| `src/adapters/live/identity-provider.ts` | Adaptador AWS de producción (Face Liveness) | Solo puerto + dominio del módulo |
| `src/adapters/live/identity-provider-camara.ts` | Camino demo con cámara (guard de `DEMO_MODE`) | Solo puerto + dominio del módulo |
| `src/adapters/live/rekognition-identidad.ts`, `textract-cedula.ts`, `cedula-aproximada.ts`, `dimensiones-imagen.ts` | Detalle Rekognition/Textract | Solo dominio del módulo + SDKs AWS |
| Tests de contrato y unitarios de todos los anteriores | La misma suite corre contra live y contra el mock de referencia | — |

Los adaptadores **ya** dependen solo del puerto y del dominio genérico — la regla "nunca de tipos del expediente" se cumple hoy; la extracción no exige refactor de acoplamiento, solo mover y parametrizar.

### Queda en SeguroLoTengo

- `src/domain/verificacion-identidad.ts` — la **orquestación**: expediente, evidencia (`EvidenceStore`), registro civil, intentos antes de `ASISTENCIA_IDENTIDAD`, bloqueo por cédula (regla inviolable #11). Es el único archivo de identidad acoplado al producto, y es correcto que lo sea.
- `src/ports/registro-civil.ts` y su consumo — ítem 33, específico de Paraguay y del flujo CONFÍO.
- `src/domain/catalogo-identidad.ts` — opciones de PAÍS DE NACIMIENTO y ESTADO CIVIL: eso es FIPF/SEPRELAD, no identidad genérica.
- `src/adapters/mock/identity-provider.ts` — está atado a las personas de prueba y al estado compartido del demo. El paquete llevará un **mock de referencia propio** (mínimo, sin personas) para sus tests de contrato; el mock rico del demo sigue siendo de SeguroLoTengo.
- Las pantallas y Route Handlers de P5 (`src/app/(flujo)/identidad/`, `src/app/api/p5/`).

### Abierto (se decide en la fase 1, no ahora)

- **Componentes de captura UI** (`CapturaConCamara.tsx`, `PanelPruebaDeVida.tsx`, `PruebaDeVidaEnVivo.tsx`, `geometria-captura.ts`): reutilizables pero atan a React/Next/Tailwind y arrastran el chunk de Amplify UI. Si se extraen, va como **paquete aparte** (`…/ui`), nunca dentro del núcleo.
- Nombre del paquete (propuesta: `@aab1/onboarding-identidad`) y registro de publicación para la fase 2 (GitHub Packages del org vs dependencia por git).
- §7 de `RECOMENDACIONES_ONBOARDING_IDENTIDAD.md` (procedencia de los umbrales): en fase 2 una copia viaja con el paquete; la referencia del producto queda acá.

## Reglas que el paquete conserva (no negociables)

1. **Toda decisión biométrica sale como `DecisionBiometrica`** — puntuación cruda + umbral + versión de modelo + versión de política. El paquete **decide y reporta; nunca persiste**: la evidencia es del host (acá, regla inviolable #10). El paquete no depende de `EvidenceStore` ni de ningún repositorio.
2. **Escala 0–100 y umbral facial 99** (el camino demo-cámara usa 90, sellado con `VERSION_POLITICA_IDENTIDAD_DEMO`). Bajar umbrales exige subir `VERSION_POLITICA_IDENTIDAD`, que pasa a estar ligada al **versionado semántico del paquete**: cambio de política ⇒ major.
3. **`CapturaSelfie` sigue siendo unión `VIDEO` | `SESION_LIVENESS`** y cada adaptador rechaza la variante que no atiende. El navegador nunca manda puntuaciones.
4. **El guard del camino demo se vuelve configuración explícita**: hoy el constructor tira si `DEMO_MODE !== "true"`; en el paquete la variable de entorno de un producto no puede ser el seguro de todos, así que el constructor exigirá un flag de configuración con nombre inequívoco (p. ej. `modoDemostracionSinPruebaDeVida: true`) que cada host debe encender a sabiendas. Mismo comportamiento: sin el flag, no arranca.
5. **La selfie nunca entra por archivo** — `origenCapturaAdmitido()` viaja con el módulo y el host debe imponerlo en su borde HTTP, como hoy lo hace el Route Handler de P5.

## Parametrizaciones pendientes (fase 1)

- `mrz.ts`: `CODIGO_PARAGUAY`/`ESTADO_EMISOR_NO_ES_PARAGUAY` → estado emisor esperado **configurable**, con `PRY` como valor que pasa SeguroLoTengo.
- `documento-regional.ts`: ya es paramétrico (PY/BO por marcadores); el catálogo de marcadores por país queda en el paquete y el host elige el subconjunto aceptado (hoy `IDENTITY_PAISES_CEDULA`).
- Los textos de error hacia la persona **no** van en el paquete: devuelve códigos (`MotivoRechazo`, etc.) y cada producto los redacta — SeguroLoTengo conserva su voseo y su regla de mensajes accionables.

## Plan por fases

**Fase 1 — workspace interno (este repo).** `packages/identidad/` como workspace npm; se mueven los archivos de la tabla, se aplican las parametrizaciones, `transpilePackages` en Next si hace falta, y la suite completa (unitarios + contrato + E2E) queda en verde con SeguroLoTengo importando del paquete. Amplify sigue construyendo igual.
**Fase 2 — endurecer la frontera.** Mock de referencia propio, tests de contrato dentro del paquete, README con la procedencia de umbrales, CI del paquete, y regla de lint que prohíba a `packages/identidad` importar de `src/`.
**Fase 3 — repo propio.** Historia migrada a un repositorio nuevo en `segurolotengopy`, publicación versionada, y SeguroLoTengo consume la dependencia como cualquier otro proyecto. Recién acá otro producto lo usa sin clonar este repo.

Cada fase es un PR propio con la suite en verde; ninguna fase cambia comportamiento observable de P5.
