<!--
Gracias por el aporte. Completá lo que aplique y borrá lo que no: una
plantilla llena de secciones vacías se lee peor que una corta.

Los comentarios como este no se ven en el PR publicado.
-->

## Qué cambia y por qué

<!--
En una o dos frases: qué hace este cambio y qué problema resuelve. El "por
qué" importa más que el "qué" — el diff ya muestra el qué.
-->

## Tipo de cambio

- [ ] Corrección de un error
- [ ] Funcionalidad nueva
- [ ] Cambio que rompe compatibilidad <!-- explicá abajo qué se rompe y cómo migrar -->
- [ ] Documentación o normativa
- [ ] Infraestructura, CI/CD o dependencias
- [ ] Refactor o mejora interna, sin cambio de comportamiento

## Issues relacionados

<!-- `Closes #123` para que se cierre solo al mergear. Si no hay, borrá esta sección. -->

## Cómo se probó

<!--
Qué corriste y qué observaste, no solo "pasan los tests". Si hay un caso
límite que motivó el cambio, decí cómo lo reprodujiste antes y después.
-->

## Capturas o video

<!-- Solo si toca la UI. Antes y después, y móvil si el cambio se ve distinto ahí. -->

---

## Antes de pedir revisión

- [ ] `npm run typecheck && npm run lint && npm test` en verde localmente
- [ ] `npm run seguridad` si el cambio toca dependencias o `infra/`
- [ ] Los 4 jobs de CI en verde: **Typecheck, lint y tests** · **Gitleaks** · **Trivy** · **Semgrep**
- [ ] El PR no incluye secretos, credenciales, `.env` ni datos de personas reales
- [ ] Los commits explican el porqué del cambio

## Cumplimiento

<!--
El checklist de CLAUDE.md, "Antes de cerrar una tarea". Marcá solo lo que
aplique a este PR: un cambio de documentación no toca casi nada de acá.
-->

- [ ] Respeta el orden de `PASOS_FLUJO` y el detalle de `docs/ESPECIFICACION_PANTALLAS.md`
- [ ] Si toca Solicitud o FIPF: los campos existen y respetan `Solicitud.pdf` / `FIPF.pdf`
- [ ] Toda regla nueva tiene su fila en la matriz de cumplimiento, **o** está marcada explícitamente como decisión de producto y no de ley
- [ ] Toda norma citada tiene su texto oficial en `docs/normativa/` (ver `docs/normativa/INDICE.md`)
- [ ] Si usa una integración externa: está en `docs/Tabla de Integraciones externas - Tabla.csv` y respeta las reglas transversales
- [ ] Se generan y persisten las evidencias correspondientes vía `EvidenceStore`
- [ ] Si toca firma: va sobre el documento único, con los firmantes de `firmantes-documento.ts`
- [ ] Si toca pago: ocurre **después** de la firma, es idempotente, y el certificado se emite en la misma escritura que el cobro
- [ ] Ningún dato de salud, PEP, tarjeta o cédula queda expuesto en logs, analítica o trazas de error

## Riesgo y despliegue

<!--
Qué se rompe si esto sale mal, y cómo se vuelve atrás. Si el cambio es
reversible con un revert, alcanza con decirlo.
-->

> [!WARNING]
> **El merge a `main` ES el despliegue a producción**: Amplify tiene
> `autoBuild` encendido en esa rama. Ver `docs/POLITICA_DE_DESPLIEGUE.md`
> antes de aprobar.
