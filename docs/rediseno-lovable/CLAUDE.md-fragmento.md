# Fragmento para `CLAUDE.md` → sección «Convenciones de UI»

Pegar al final de esa sección cuando exista el tag `diseno-v1-aprobado`
(fase 3.4 de `docs/rediseno-lovable/GUIA_REDISENO_LOVABLE.md`). Reemplazar
`<org>`, `<repo-diseno>` y la fecha.

---

- **Fuente visual del flujo v3 (desde el <fecha>):** el prototipo de Lovable
  `github.com/<org>/<repo-diseno>`, etiqueta **`diseno-v1-aprobado`**. Es un
  prototipo React + Tailwind sin backend y con datos ficticios; **no se
  fusiona nunca con este repositorio** — se lee (clon hermano
  `../slt-diseno-lovable` o MCP de Lovable) y se porta. Método obligatorio,
  en `docs/rediseno-lovable/semilla/04-mapa-porteo.md`: **el armazón JSX de
  cada pantalla se toma del prototipo** y sobre él se cuelgan los datos y las
  llamadas que el producto ya tiene; el CSS se porta literal y encapsulado
  (`src/app/lovable-v4.css`, bajo `[data-flujo="v3"]`); los componentes
  shadcn del prototipo **no se instalan**, se reproducen en
  `src/components/shared/`. No se trabaja «por diferencias» contra la
  pantalla existente. Textos, campos y valores siguen mandando desde
  `docs/ESPECIFICACION_PANTALLAS.md`: lo que el prototipo traiga de más se
  reporta como divergencia en la Bitácora y no se copia. Las relajaciones de
  v3 en componentes compartidos con v2 van detrás de la prop `canvas`, y
  `npm run test:e2e` (v2, producción) corre en cada sesión de porteo.
