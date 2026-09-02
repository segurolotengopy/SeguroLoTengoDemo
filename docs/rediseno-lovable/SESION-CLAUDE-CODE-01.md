# Sesión 01 de Claude Code — publicar el canvas en Lovable y dejar el repo listo

> **Esta sesión tiene que correr en el ThinkPad, no en Claude Code web.**
> El material (docs/rediseno-lovable/, _lovable-push/) está en la carpeta local
> `~/segurolotengo-demo` y todavía no está en GitHub; Claude Code en la nube
> clona desde GitHub y no lo ve (ya pasó el 02-sep: esa sesión solo pudo tocar
> CLAUDE.md y la Bitácora, y dejó la rama `docs/rediseno-lovable-canvas`).

Abrir una **terminal local** en el ThinkPad, `cd ~/segurolotengo-demo`,
`claude`, y pegar **todo** el bloque de abajo como primer mensaje. Cuando Claude Code pida
permiso para un comando, responder `y`. La única acción que queda en manos de
Andres dentro de esta sesión es completar el OAuth de Lovable en el navegador
cuando se abra (paso 4).

---

```
Leé CLAUDE.md, docs/BITACORA.md (entrada más reciente) y
docs/rediseno-lovable/GUIA_REDISENO_LOVABLE_v2-desde-fase3.md (secciones 0 a 3).
Contexto: el prototipo visual del flujo v3 se está haciendo en Lovable
(repositorio github.com/segurolotengo-diseno/slt-diseno-v3, TanStack Start,
rama main). Una sesión de Cowork preparó el commit 4771f03 con el canvas
aprobado como fuente visual, pero no pudo hacer el push por restricciones de
su sandbox; lo dejó como bundle de git y ya hay un clon parcial en
~/slt-diseno-lovable. Hacé esto, en orden, verificando cada paso antes de seguir:

0. SITUARSE. `git status` y `git branch --show-current`. Verificá que existen
   docs/rediseno-lovable/ (con semilla/canvas/) y _lovable-push/ en el árbol
   local; si no existen, frená y decímelo. Después `git fetch origin` y
   `git checkout docs/rediseno-lovable-canvas` (la rama que dejó la sesión web
   del 02-sep, commit eeca5fd, con CLAUDE.md y una entrada de Bitácora
   parcial); si tenés cambios locales sin commitear, hacé `git stash` antes y
   `git stash pop` después. Agregá docs/rediseno-lovable/ al índice y commiteá:
   «docs: guía, semilla y canvas del rediseño con Lovable (desde Cowork)».
   No agregues _lovable-push/.

1. PUBLICAR EL COMMIT EN EL REPO DE LOVABLE.
   - Si ~/slt-diseno-lovable existe: `git -C ~/slt-diseno-lovable checkout -B main origin/main`.
     Si no existe: `git clone ~/segurolotengo-demo/_lovable-push/slt-diseno-v3.bundle ~/slt-diseno-lovable && git -C ~/slt-diseno-lovable checkout -B main origin/main`.
   - Confirmá con `git -C ~/slt-diseno-lovable log --oneline -3` que el HEAD es
     4771f03 «Canvas aprobado ce0c8332 como fuente visual…» sobre 955fd0e.
   - `git -C ~/slt-diseno-lovable remote set-url origin https://github.com/segurolotengo-diseno/slt-diseno-v3.git`
   - `git -C ~/slt-diseno-lovable push origin main`. Si pide credenciales, usá
     la sesión de `gh` de segurolotengopy (`gh auth status`); si no hay, decímelo.
   - Verificá: `git ls-remote --heads origin main` devuelve 4771f03.
   - Verificá el contenido remoto: `gh api repos/segurolotengo-diseno/slt-diseno-v3/contents/docs/canvas --jq '.[].name'`
     tiene que listar canvas-plantilla.html, canvas-estilos.css, canvas-logica.js,
     canvas-textos.md, canvas-modales.md, canvas-reglas-visuales.md y capturas.

2. LIMPIAR. Borrá ~/segurolotengo-demo/_lovable-push/ (no debe entrar al repo
   de producción) y confirmá con `git status` que no quedó nada de eso en el
   árbol de trabajo.

3. INTEGRAR LA ADENDA EN LA ESPECIFICACIÓN. Aplicá
   docs/rediseno-lovable/semilla/pantallas/ESPECIFICACION_PANTALLAS-ADENDA-2026-09-01.md
   sobre docs/ESPECIFICACION_PANTALLAS.md: §A reemplaza la descripción del pie
   legal en «Elementos comunes» por el texto literal y la tabla de modales;
   §B fija los tres bloques de cabecera con el sufijo (provisional) y el
   tercer bloque solo en el inicio; §C agrega la tabla de rótulos del
   carrusel en «Inicio»; §D reemplaza el párrafo «Paleta y tipografía»; §E
   se agrega como subsección «Divergencias con el canvas que se mantienen».
   No cambies ningún otro texto. Dejá al inicio del documento una línea de
   revisión: «Adenda del 01-sep-2026 integrada (canvas ce0c8332)».

4. MCP DE LOVABLE. `claude mcp add --scope user --transport http lovable "https://mcp.lovable.dev"`.
   Después decime que ejecute /mcp y que complete el OAuth en el navegador;
   esperá mi confirmación. Luego, con el MCP, listá los proyectos y leé
   src/index.css del proyecto slt-diseno-v3 sin modificar nada, y reportá si
   todavía contiene «Archivo», «#ec3013» o «radius: 0» (son los rastros que
   corrige el prompt P0-bis).

5. CLAUDE.md. La sesión web ya agregó el párrafo a «Convenciones de UI»
   (commit eeca5fd). Verificá que coincide con
   docs/rediseno-lovable/CLAUDE.md-fragmento.md (org segurolotengo-diseno,
   repo slt-diseno-v3, «pendiente de aprobación; hasta entonces, rama main»)
   y corregí solo si difiere.

6. VERIFICACIÓN Y CIERRE. `npm run verify` (no tocaste código, tiene que
   seguir en verde; anotá el número de tests). Completá la entrada de
   docs/BITACORA.md que dejó la sesión web (no crees otra): marcá como hechos
   los pasos 1–4, con el caso (el hallazgo de las dos capas del canvas,
   guía v2 §0), qué cambió, qué hizo Andres (OAuth de Lovable, los comandos
   del bundle), verificaciones con números y qué queda abierto (pegar el
   Knowledge v2 en Lovable y enviar P0-bis). Seguís en la rama docs/rediseno-lovable-canvas.
   Commit y push de la rama; no abras PR todavía, decime el resultado.

Si algo de esto contradice CLAUDE.md o la matriz de cumplimiento, frená y
consultame antes.
```
