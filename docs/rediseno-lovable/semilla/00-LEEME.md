# Paquete de semilla para Lovable — SeguroLoTengo · Rediseño visual v3

Generado el 01-sep-2026 desde `segurolotengo-demo` (rama de trabajo del
01-sep, suite 1247 en verde). Todo lo que hay acá **sale del repositorio**; nada
está inventado. Si el repo cambia (tokens, textos), este paquete se regenera
antes de arrancar un proyecto nuevo en Lovable.

## Contenido

| Archivo / carpeta               | Qué es                                                                                                  | A dónde va en Lovable                                        |
| :------------------------------ | :------------------------------------------------------------------------------------------------------ | :----------------------------------------------------------- |
| `01-tokens.css`                 | Paleta de marca, tokens semánticos, tema oscuro y la piel v3 del canvas. Mismos nombres que producción. | `src/index.css` (se pega completo)                           |
| `referencia-canvas-v3.css`      | Copia literal de `src/app/canvas-v3.css`: las clases de componente del canvas aprobado.                 | `docs/referencia-canvas-v3.css` (referencia, no se importa)  |
| `02-knowledge-lovable.md`       | Instrucciones del proyecto para el agente de Lovable: alcance solo visual, reglas, datos ficticios.     | **Project → Settings → Knowledge** (pegar completo)          |
| `03-prompts-lovable.md`         | Los nueve prompts en orden (P0 cascarón … P8 auditoría).                                                | Se envían uno por uno en el chat de Lovable                  |
| `04-mapa-porteo.md`             | Para Claude Code: de dónde sale cada cosa del prototipo y a dónde va en Next.js, y con qué método.      | Queda en el repo de producción                               |
| `05-prompt-claude-code-porteo.md` | Plantillas de prompt para las sesiones de porteo.                                                     | Queda en el repo de producción                               |
| `pantallas/ESPECIFICACION_PANTALLAS.md` | Copia literal de la especificación de las seis pantallas (textos, campos, valores).             | `docs/pantallas/ESPECIFICACION_PANTALLAS.md` en Lovable      |
| `marcas/*.svg`                  | Los cuatro SVG de marca (isologos y logos de Alianza e Interseguros).                                   | `public/marca/`                                              |

## Lo que hay que subir además desde el repo (no está duplicado acá por peso)

- Las ocho fotos del flujo v3: `public/v3/*.jpg` (~1,2 MB) → `public/v3/` en
  Lovable. Son las fotos del canvas aprobado (hero × 4, familia × 4).
- Opcional, como referencia visual del estado actual: las capturas del camino
  feliz de v3. Se generan con
  `CAPTURAS_DISENO=./capturas-v3 npm run test:e2e:v3` y se suben a
  `docs/capturas-actual/` en Lovable. Sirven para decirle «partí de esto».

## Lo que NO se sube nunca a Lovable

- `.env.local`, secretos, claves de AWS, `ADMIN_CONSOLE_KEY`, `DEMO_PANEL_KEY`.
- `src/adapters/`, `src/repositories/`, `src/domain/`, `infra/`: nada del
  backend. El prototipo no lo necesita y es superficie de fuga innecesaria.
- Datos de personas reales. Las personas de prueba de `personas.ts` tampoco:
  en Lovable se usa **Ana Ejemplo Modelo** (ver Knowledge).
- Los PDF de normativa y los documentos de proveedores (`docs/Integraciones/`,
  `docs/normativa/`): son documentación de terceros con condiciones de uso.

## Orden de carga en Lovable (resumen; el detalle está en la guía, fase 2)

1. Crear el proyecto vacío con un prompt mínimo («Proyecto React + Tailwind
   vacío, sin backend, en español») — Lovable arranca con su plantilla.
2. Pegar `02-knowledge-lovable.md` en Knowledge.
3. Subir los archivos: `01-tokens.css` y `referencia-canvas-v3.css` a `docs/`,
   `pantallas/ESPECIFICACION_PANTALLAS.md` a `docs/pantallas/`, los SVG a
   `public/marca/`, las fotos a `public/v3/`. (Lovable permite arrastrar
   archivos al chat o subirlos desde el editor de código; en el editor se
   ve la carpeta.)
4. Conectar GitHub (Lovable crea `repo-diseno` en la organización separada).
5. Enviar P0 y verificar `/design-system` antes de seguir.
