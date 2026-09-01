# Guía operativa — Rediseño visual de SeguroLoTengo con Lovable y porteo con Claude Code

**Fecha:** 01-sep-2026 · **Decisiones de Andres (esta sesión):** alcance **solo
visual**; el repositorio del diseño vive en una **organización de GitHub
separada**; se entrega guía + paquete de semilla.
**Flujo objetivo:** el de **3 pasos** (v3), que es el que describe
`docs/ESPECIFICACION_PANTALLAS.md` (reescrita el 29-ago) y el que corre hoy
detrás de `FLUJO_V3`. El flujo v2 de 8 pasos (producción con el flag apagado)
**no se rediseña** y tiene que quedar intacto.

---

## 0. Por qué el plan no es «repo1 → repo2 → Lovable»

El plan original era clonar `segurolotengo-demo` en un segundo repositorio y
darle ese repositorio a Lovable como origen. Verificado contra la
documentación oficial de Lovable el 01-sep-2026, eso no es posible por dos
razones independientes:

1. **Lovable no importa repositorios existentes.** La documentación es
   textual: *«Export only. You can't import an existing repository into
   Lovable»* y *«currently there is no way to start a Lovable project from
   already existing code on for example GitHub»*. La sincronización con GitHub
   es bidireccional, pero **el repositorio lo crea Lovable** al conectar un
   proyecto. Hay artículos de terceros (mayo 2026) que describen un botón
   «Import from GitHub»; la documentación oficial lo contradice y es la que
   manda. Si en su cuenta aparece esa opción, es un despliegue gradual: no se
   diseña la operación sobre esa base.
2. **El stack es incompatible.** `segurolotengo-demo` es Next.js 15 App Router
   (fijado en 15 por Amplify), con DynamoDB, S3, Rekognition, Textract,
   Terraform y 41 Route Handlers. Lovable genera **TanStack Start (SSR,
   proyectos nuevos desde mayo 2026)** o **React + Vite**, siempre con
   Tailwind. No soporta Next.js.

Y una tercera razón de producto: `CLAUDE.md` prohíbe inventar campos, pasos,
textos y validaciones, y Lovable inventa por diseño. Darle el sistema entero
sin acotarlo produce un rediseño con campos que no existen y textos sin voseo.

**El plan corregido** invierte la dirección de los datos: Lovable no recibe el
repositorio, recibe un **paquete de semilla** (tokens, especificación,
marcas, reglas) y produce un **prototipo de interfaz separado**, en su propio
repositorio. Cuando el prototipo está aprobado, Claude Code lo lee desde
`segurolotengo-demo` y **porta** (traduce, no copia) el diseño a Next.js,
pantalla por pantalla, con la cadena de despliegue de siempre.

```
segurolotengo-demo (Next.js)  — única fuente de verdad del producto
   │  (1) paquete de semilla: docs/rediseno-lovable/semilla/
   ▼
Lovable · proyecto «slt-diseno-v3»  ──sync──►  org separada / repo-diseno
   │  prototipo React+Tailwind de las 6 pantallas, datos ficticios, sin backend
   │  iteración visual → auditoría de textos → aprobación → tag diseno-v1-aprobado
   ▼
   (2) Claude Code en segurolotengo-demo lee repo-diseno (clon de lectura o MCP)
   (3) porta tokens → cascarón → 6 pantallas, una sesión por pantalla, detrás de FLUJO_V3
   (4) verify → seguridad → PR → CI → merge (= despliegue)
```

---

## 1. Prerrequisitos

| Qué                                        | Detalle                                                                                                                                    |
| :----------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------- |
| Cuenta Lovable                             | Cualquier plan sirve para el MCP y el sync con GitHub. `send_message` y `create_project` consumen créditos; leer archivos no.               |
| Cuenta GitHub con la que se crea la org    | Recomendado: **`segurolotengopy`** (la que es dueña de `SeguroLoTengoDemo` y de la Amplify GitHub App), con 2FA activo. No la personal.     |
| Claude Code instalado en el ThinkPad       | `claude --version`. Node por nvm, como ya tiene.                                                                                            |
| `segurolotengo-demo` limpio                | `git status` sin cambios pendientes y `npm run verify` en verde antes de empezar el porteo (fase 5).                                        |
| Paquete de semilla                         | `docs/rediseno-lovable/semilla/` (este mismo directorio). Regenerarlo si `globals.css`, `canvas-v3.css` o `ESPECIFICACION_PANTALLAS.md` cambiaron después del 01-sep. |

> **Punto de control 1.** Antes de seguir, confirme en Lovable → Settings →
> Integrations que la opción de conectar GitHub está disponible en su plan, y en
> GitHub que la cuenta `segurolotengopy` puede crear organizaciones (Settings →
> Organizations → New organization).

---

## 2. Fase 1 — La organización de GitHub separada

**Por qué separada (además de su decisión):** la GitHub App de Lovable se
instala **una sola vez por cuenta u organización** y no se puede reinstalar
sobre la misma tras desconectar. Instalarla en `segurolotengopy` mezclaría
sus permisos con el repositorio de producción, sobre el que ya está instalada
la Amplify GitHub App con mínimo privilegio (`docs/DECISION_MIGRACION_GITHUB_APP.md`).
Una organización aparte deja a Lovable con acceso **solo** a lo que Lovable
crea.

2.1. En GitHub, con la sesión de `segurolotengopy`: **Settings → Organizations
→ New organization → Free**. Nombre sugerido: `segurolotengo-diseno`. Contacto:
el correo de la cuenta. No agregue miembros todavía.

2.2. En la organización: **Settings → Member privileges → Base permissions:
No permission**; **Repository creation: solo owners**. **Settings →
Authentication security → Require two-factor authentication**.

2.3. **No cree el repositorio a mano.** Lovable lo va a crear al conectarse
(fase 3.4). Si lo crea usted antes, Lovable creará otro igual con sufijo y
quedará un repositorio huérfano.

2.4. Anote el nombre de la org: se usa en la fase 3.4 y en la fase 5.1.

> **Punto de control 2.** `https://github.com/orgs/<org>/people` muestra solo
> a `segurolotengopy` como owner y la org exige 2FA. Sin repositorios todavía.

---

## 3. Fase 2 — El proyecto en Lovable y la carga de la semilla

3.1. **Crear el proyecto.** En Lovable → New project. Prompt inicial mínimo,
para que arranque con su plantilla y sin inventar pantallas:

```
Creá un proyecto React + Tailwind vacío, en español, sin backend, sin
autenticación y sin base de datos. Solo una página en blanco con el título
"SeguroLoTengo — prototipo visual". No agregues nada más.
```

Nómbrelo `slt-diseno-v3`. Si Lovable ofrece elegir plantilla (TanStack Start o
Vite), **cualquiera de las dos sirve**: el porteo lee CSS y JSX, no el
enrutador. Vite es más simple si aparece la opción.

3.2. **Knowledge.** Project → Settings → Knowledge. Pegue **completo**
`semilla/02-knowledge-lovable.md`. Guarde. Este texto es lo que impide que
Lovable agregue campos o invente textos; sin él, el resto de la guía no
funciona.

3.3. **Subir los archivos de la semilla.** Dos caminos, y conviene usar el
segundo para lo que va a carpetas concretas:

- Arrastrar al chat: sirve para imágenes y para que el agente «vea» un
  archivo, pero Lovable decide dónde lo guarda.
- **Editor de código** (botón `</>` o «Code» arriba de la vista previa):
  permite crear carpetas y archivos con el contenido exacto. Cree:
  - `docs/01-tokens.css` ← `semilla/01-tokens.css`
  - `docs/referencia-canvas-v3.css` ← `semilla/referencia-canvas-v3.css`
  - `docs/pantallas/ESPECIFICACION_PANTALLAS.md` ← `semilla/pantallas/ESPECIFICACION_PANTALLAS.md`
  - `public/marca/` ← los cuatro SVG de `semilla/marcas/`
  - `public/v3/` ← las ocho fotos de `public/v3/` del repo de producción

  Alternativa más rápida si el editor de Lovable incomoda: conecte GitHub
  primero (3.4), clone `repo-diseno`, copie los archivos en esas rutas, haga
  `git push`; Lovable los toma en el próximo sync. Es el mismo mecanismo que
  usará Claude Code al revés.

> **Punto de control 3.** En el editor de código de Lovable existen
> `docs/01-tokens.css`, `docs/pantallas/ESPECIFICACION_PANTALLAS.md` y
> `public/marca/interseguros-isologo.svg`. Abra la especificación y verifique
> que el primer título dice «Especificación de pantallas — SeguroLoTengo».

3.4. **Conectar GitHub.** Project → Settings → GitHub → **Connect**. GitHub
pedirá instalar la **Lovable GitHub App**: elija como destino **la
organización nueva** (no `segurolotengopy` ni la cuenta personal). Cuando
GitHub pregunte en qué repositorios, deje que Lovable cree el suyo. Lovable
crea `repo-diseno` (el nombre lo toma del proyecto; se puede renombrar en
GitHub después, el sync no se rompe) y hace el primer push.

Detalles que la documentación de Lovable fija y conviene saber:

- El sync es **bidireccional pero de una sola rama** a la vez (la rama activa
  del proyecto; `main` por defecto). Los pushes a esa rama entran a Lovable;
  otras ramas no.
- Lovable **no guarda archivos mayores a 10 MB**; GitHub rechaza mayores a
  100 MB. Las fotos de `public/v3/` están muy por debajo.
- **No se puede reconectar al mismo repositorio** después de desconectar.
  No desconecte para «probar».

3.5. En el repositorio recién creado, en GitHub: **Settings → General →
Visibility: Private** (verifique; suele crearse privado). No active branch
protection en `main` todavía: Lovable hace push directo a esa rama y una
regla lo bloquearía.

> **Punto de control 4 (crítico).** En Lovable, en el editor de código, edite
> una línea de `docs/01-tokens.css` (por ejemplo, agregue un comentario) y
> guarde. En menos de un minuto tiene que aparecer un commit nuevo en
> `github.com/<org>/<repo-diseno>/commits/main` firmado por Lovable. Si no
> aparece, no siga: revise Settings → GitHub en Lovable.

---

## 4. Fase 3 — Iteración visual y aprobación

4.1. **Envíe P0** (`semilla/03-prompts-lovable.md`). Verifique
`/design-system`: tokens con **los mismos nombres** que `globals.css`, Archivo
cargada, conmutador de tema funcionando con `data-tema="oscuro"`.

> **Punto de control 5.** Abra el `src/index.css` generado en el editor de
> código. Tiene que contener `--color-naranja-600`, `--tema-fondo`,
> `[data-flujo="v3"]` y `@custom-variant dark`. Si Lovable «reorganizó» los
> tokens con otros nombres (`--primary`, `--brand-orange`), pídale que los
> restaure con un prompt: *«Los nombres de los tokens tienen que ser exactamente
> los de docs/01-tokens.css. Restauralos sin cambiar los valores que
> propusiste.»* No avance con nombres distintos: el porteo depende de eso.

4.2. **Una pantalla por prompt** (P1 → P6). Después de cada una:

- Vista previa en **celular (360 px) y escritorio**. Tema claro y oscuro.
- Lea la lista de «textos usados / faltantes» que devuelve el agente. Si
  reporta faltantes, es que la especificación no cubre algo: **no deje que lo
  invente**; anótelo para decidirlo en `ESPECIFICACION_PANTALLAS.md` después.
- Pida los ajustes visuales que quiera, cuantos haga falta. Ese es el valor
  de Lovable. Sólo evite pedidos que toquen la lista de «no podés cambiar»
  del Knowledge; si lo hace, Lovable debería avisarle (lo dice el Knowledge),
  pero verifíquelo.

4.3. **P7** (estados transversales) y **P8** (auditoría de textos). La tabla de
P8 es su prueba de aceptación: cada texto de la especificación en «sí», y
ningún texto del prototipo fuera de la especificación. Corrija con prompts
puntuales hasta que la tabla cierre.

4.4. **Aprobación y congelamiento.** Cuando apruebe:

```bash
git clone https://github.com/<org>/<repo-diseno>.git slt-diseno-lovable
cd slt-diseno-lovable
git tag -a diseno-v1-aprobado -m "Diseño visual v3 aprobado por Andres el <fecha>"
git push origin diseno-v1-aprobado
```

El tag es lo que Claude Code va a leer en la fase 5: **el prototipo puede
seguir cambiando en Lovable después, pero el porteo se hace contra el tag**.
Cada nueva aprobación es un tag nuevo (`diseno-v2-aprobado`, …).

Registre la aprobación en `docs/BITACORA.md` de `segurolotengo-demo`
(entrada breve: fecha, tag, URL del repo, qué pantallas cubre).

> **Punto de control 6.** `git -C slt-diseno-lovable tag` lista
> `diseno-v1-aprobado` y `git ls-remote --tags origin` lo muestra en GitHub.

---

## 5. Fase 4 — Claude Code conectado al diseño

Hay dos vías, y **se usan las dos**: el clon para leer en volumen, el MCP para
consultar y pedir ajustes sin salir de Claude Code.

5.1. **Clon de lectura, hermano del repo de producción:**

```bash
cd ~                                   # o donde viva segurolotengo-demo
git clone --branch main https://github.com/<org>/<repo-diseno>.git slt-diseno-lovable
git -C slt-diseno-lovable checkout diseno-v1-aprobado
```

Queda `~/segurolotengo-demo` y `~/slt-diseno-lovable` lado a lado; las
plantillas de prompt de `semilla/05-prompt-claude-code-porteo.md` asumen esa
ruta relativa (`../slt-diseno-lovable`).

5.2. **MCP de Lovable en Claude Code** (alcance de usuario, para no dejar la
configuración dentro del repositorio de producción):

```bash
claude mcp add --scope user --transport http lovable "https://mcp.lovable.dev"
```

Abra Claude Code en `segurolotengo-demo` y ejecute `/mcp`: `lovable` debe
figurar. La primera herramienta que use abre el navegador para el OAuth de
Lovable; inicie sesión con la cuenta dueña del proyecto. **No hay API key**:
es OAuth siempre. (Alternativa equivalente: `/plugin install
lovable@claude-plugins-official`.)

Tres advertencias de la documentación de Lovable que importan acá:

- **El alcance del OAuth es toda la cuenta de Lovable**, no un proyecto. Si
  en esa cuenta hay otros proyectos, Claude Code los ve.
- **Las herramientas operan en vivo:** `send_message` edita el proyecto real
  y consume créditos; `deploy_project` publica; `query_database` ejecuta SQL
  (no aplica acá, el prototipo no tiene base). Para leer, use `list_files`,
  `read_file`, `get_diff`, `list_edits`, `get_project`.
- En planes Enterprise de Lovable, un administrador tiene que habilitar
  «Third-party MCP clients» en Settings → Security.

> **Punto de control 7.** En Claude Code, dentro de `segurolotengo-demo`, pida:
> *«Con el MCP de Lovable, listá los archivos del proyecto slt-diseno-v3 y
> leé src/index.css. No modifiques nada.»* Tiene que devolver el árbol y el
> CSS con los tokens. Si pide autorización de OAuth, complétela en el
> navegador y repita.

5.3. **Instrucción de repositorio.** Agregue a `CLAUDE.md` de
`segurolotengo-demo`, en «Convenciones de UI», el párrafo de
`CLAUDE.md-fragmento.md` (en este directorio). Así toda sesión futura sabe
que el prototipo de Lovable es la fuente visual del flujo v3 y cuál es el
método de porteo.

---

## 6. Fase 5 — Porteo a `segurolotengo-demo`

Ocho sesiones de Claude Code, cada una con su rama, su Bitácora y su PR.
Plantillas exactas en `semilla/05-prompt-claude-code-porteo.md`; mapa de
correspondencia y método en `semilla/04-mapa-porteo.md`.

| Sesión | Rama                                  | Alcance                                                                   |
| :----- | :------------------------------------ | :------------------------------------------------------------------------ |
| 0      | `feat/rediseno-lovable-00-tokens`     | `globals.css` (diff de valores), `lovable-v4.css`, cascarón compartido, `/design-system` |
| 1      | `feat/rediseno-lovable-01-inicio`     | `/`                                                                       |
| 2      | `feat/rediseno-lovable-02-inscripcion`| `/inscripcion` (prop `canvas` en `VerificacionIdentidad`)                 |
| 3      | `feat/rediseno-lovable-03-seguro`     | `/seguro` (prop `canvas` en `SelectorDePlanes`)                           |
| 4      | `feat/rediseno-lovable-04-pago-y-firma` | `/pago-y-firma`, `ModalBancard`, `ModalVisorPdf`                        |
| 5      | `feat/rediseno-lovable-05-confirmacion` | `/confirmacion`                                                         |
| 6      | `feat/rediseno-lovable-06-revision-manual` | `/revision-manual`                                                   |
| 7      | `feat/rediseno-lovable-07-cierre`     | Retiro de `canvas-v3.css`, `GUIA_DE_ESTILOS.md`, `CLAUDE.md`              |

**El método, que es lo que importa** (detalle en el mapa §0): el armazón JSX
de cada pantalla se toma del prototipo y sobre él se cuelgan los datos y
llamadas que el producto ya tiene. No se trabaja «por diferencias» contra la
pantalla actual — es exactamente lo que hizo lento y frustrante el porteo del
canvas (Bitácora 01-sep (c) y (d)). El CSS se porta literal y encapsulado; los
componentes shadcn del prototipo no se instalan, se reproducen.

Verificación por sesión, en este orden y sin saltear:

1. Textos contra el **código fuente** del producto (no contra el DOM).
2. `CAPTURAS_DISENO=./capturas-v4 npm run test:e2e:v3` y comparación lado a
   lado con la vista previa del prototipo a 360 y 1400 px.
3. `npm run verify` (1247 tests al 01-sep; el número sube, no baja).
4. `npm run test:e2e` — **v2 es producción con el flag apagado** y tiene que
   quedar idéntica. La Bitácora del 01-sep (g) registra cómo se rompió sin
   querer al compartir `VerificacionIdentidad`.
5. `npm run seguridad` → PR a `main` → 4 jobs en verde → merge
   (`docs/POLITICA_DE_DESPLIEGUE.md`). El merge despliega, pero con
   `FLUJO_V3` apagado en producción el rediseño no se ve ahí: se ve en el
   entorno donde el flag está en `true`.

> **Punto de control 8 (por sesión).** La entrada de Bitácora de la sesión
> cita el tag del prototipo, tiene la sección «Divergencias» (textos o campos
> del prototipo que NO se portaron y por qué) y los cuatro números de
> verificación: tests unitarios, e2e v3, e2e v2, capturas comparadas.

---

## 7. Fase 6 — Cierre

- `docs/GUIA_DE_ESTILOS.md`: sección nueva «Rediseño v4 (Lovable, fecha)»
  con la fuente (org/repo, tag), tokens que cambiaron de valor, tokens nuevos,
  y las divergencias resueltas.
- `CLAUDE.md`: el fragmento de la fase 4.3 ya lo referencia; actualizar la
  fecha y el tag.
- `repo-diseno` queda como **evidencia del diseño aprobado**. No se archiva
  ni se borra: la próxima iteración visual arranca ahí, en Lovable, con el
  Knowledge ya cargado.
- Revoque en Lovable la conexión MCP si no la va a seguir usando
  (Settings → Security → conexiones), o déjela: es OAuth revocable.

---

## 8. Riesgos y qué hacer

| Riesgo                                                                   | Señal                                                        | Acción                                                                                                       |
| :----------------------------------------------------------------------- | :----------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------- |
| Lovable renombra tokens o agrega hex sueltos                             | `src/index.css` con `--primary`, componentes con `#ec3013`    | Prompt de restauración (fase 3, PC 5). Repetir hasta que los nombres coincidan.                              |
| Lovable agrega campos o textos                                           | La lista «faltantes» trae textos que no pidió; formularios con campos nuevos | No aceptar. Recordarle el Knowledge. Si insiste, corregir en el editor de código y seguir.       |
| Datos reales en el prototipo                                             | Nombres, cédulas o teléfonos reales en la vista previa       | Reemplazar por Ana Ejemplo Modelo antes de cualquier push. El repo es privado, pero Lovable es un tercero.  |
| Lovable elige TanStack Start y el árbol no es el esperado                | `src/routes/` en vez de `src/pages/`                          | Indiferente para el porteo: se leen `src/routes/*.tsx`. Ajustar la ruta en las plantillas de prompt.        |
| Sync de GitHub no dispara                                                | PC 4 falla                                                    | Settings → GitHub en Lovable; verificar que la App está instalada en la org correcta. No desconectar.       |
| Créditos                                                                 | Lovable avisa de límite                                       | Los prompts P1–P6 son los caros; P8 es barato. Presupuestar 30–40 mensajes.                                 |
| Romper v2 (producción)                                                   | `npm run test:e2e` en rojo                                    | Cambios de v3 detrás de la prop `canvas` o de `[data-flujo="v3"]`. Nunca tocar un compartido sin correr e2e v2. |
| Alcance del OAuth del MCP                                                | Claude Code lista proyectos ajenos                            | Usar una cuenta de Lovable dedicada al proyecto si en la actual hay otros trabajos.                          |

---

## 9. Fuentes verificadas (01-sep-2026)

- Lovable — *Lovable MCP server*: <https://docs.lovable.dev/integrations/lovable-mcp-server>
  (comando `claude mcp add`, OAuth, herramientas, alcance de cuenta, créditos).
- Lovable — *Sync your Lovable project code with GitHub or GitLab*:
  <https://docs.lovable.dev/integrations/git-sync-overview> («Export only. You
  can't import an existing repository into Lovable»).
- Lovable — *Sync your Lovable project with GitHub*:
  <https://docs.lovable.dev/integrations/github> (una rama a la vez, 10 MB,
  no reconectar, App una vez por cuenta/org).
- Lovable — *FAQ*: <https://docs.lovable.dev/introduction/faq> (TanStack Start
  desde el 13-may-2026, React + Vite para proyectos anteriores; sin Next.js;
  sin importación de código existente).
- Repositorio: `CLAUDE.md`, `docs/GUIA_DE_ESTILOS.md`,
  `docs/ESPECIFICACION_PANTALLAS.md` (29-ago), `docs/plan/IMPORTACION_DISENO_3_PASOS.md`,
  `docs/POLITICA_DE_DESPLIEGUE.md`, `docs/DECISION_MIGRACION_GITHUB_APP.md`,
  `docs/BITACORA.md` (entradas del 01-sep-2026), `src/app/globals.css`,
  `src/app/canvas-v3.css`, `src/domain/rutas-flujo.ts`.
