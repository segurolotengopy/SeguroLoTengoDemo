# Pantallas v4 · recibidas el 14-sep-2026

Lo que mandó Rodrigo Fernández (Interseguros) para la capa de presentación, tal
como llegó, más el análisis contra el repositorio. El análisis y las decisiones
que tomó Andres el 15-sep-2026 están en [`ANALISIS.md`](ANALISIS.md) y en el
Bloque G de [`docs/plan/DECISIONES.md`](../../../plan/DECISIONES.md).

## Qué hay acá

| Archivo | Qué es | ¿Versionado? |
| :-- | :-- | :-- |
| `SEGUROLOTENGO_HANDOFF_PROGRAMACION_2026-09-14/` | El handoff técnico: `data/screens.json` (contrato funcional), la especificación y los catálogos de 03D, el manifiesto con el SHA-256 de cada arte, la nota para programación y un visor HTML | Sí, **sin** `assets/` |
| `…/assets/screens/aprobadas/` y `…/candidatas/` | 81 artes `APROBADA_FINAL` y 22 candidatos (PNG, 73 MB) | **No**: referencia local |
| `SEGUROLOTENGO_MANUAL_FUNCIONAL_COMPLETO_PANTALLA_POR_PANTALLA_2026-09-14.pdf` | Manual funcional, 147 páginas. **Prevalece sobre los artes** (D-28) | **No**: embebe los mismos PNG |
| `MANUAL_FUNCIONAL_TRANSCRIPCION.txt` | Texto literal del manual (`pdftotext -layout`), sin el pie repetido | Sí |
| `ANALISIS.md` | Contraste contra el repositorio, decisiones y pendientes | Sí |

## Huellas de lo que no se versiona

| Original | Bytes | SHA-256 |
| :-- | --: | :-- |
| `SEGUROLOTENGO_HANDOFF_PROGRAMACION_2026-09-14.zip` | 74 518 642 | `7b2cf4e37446597eb3d36618853cdae9773be40b83e3e3353eed58d853b36ef7` |
| `SEGUROLOTENGO_MANUAL_FUNCIONAL_COMPLETO_PANTALLA_POR_PANTALLA_2026-09-14.pdf` | 30 530 356 | `55249b7134ffebe6477807b91221b653eb7d92d53080515f040e4500ddcb0ef0` |

Cada PNG tiene su propia huella en `data/screen_manifest.csv`. Los 103 se
verificaron contra el manifiesto el 14-sep-2026 sin diferencias.

## Cómo tener la referencia local

Desde la raíz del repositorio, con el zip y el manual en `~/Descargas`:

```bash
unzip -n ~/Descargas/SEGUROLOTENGO_HANDOFF_PROGRAMACION_2026-09-14.zip 'SEGUROLOTENGO_HANDOFF_PROGRAMACION_2026-09-14/assets/*' -d docs/recepcion/2026-09-14-interseguros/02-pantallas-v4/
cp ~/Descargas/SEGUROLOTENGO_MANUAL_FUNCIONAL_COMPLETO_PANTALLA_POR_PANTALLA_2026-09-14.pdf docs/recepcion/2026-09-14-interseguros/02-pantallas-v4/
```

Y para comprobar que ningún arte fue sustituido:

```bash
cd docs/recepcion/2026-09-14-interseguros/02-pantallas-v4/SEGUROLOTENGO_HANDOFF_PROGRAMACION_2026-09-14 && tail -n +2 data/screen_manifest.csv | tr -d '\r' | awk -F, '{print $8"  "$7}' | sha256sum -c --quiet
```

Sin salida es que los 103 coinciden. Con los PNG en su lugar, `index.html` se
abre directo en el navegador.

## Reglas para quien programe con esto

- Solo se implementa lo que tiene `approval_status = APROBADA_FINAL` **y**
  `approved_for_development = true`. Los candidatos (03E y la carátula
  alternativa de 01) son referencia, nunca definitivos.
- Orden de autoridad del proyecto (D-28): **el manual**, después **el arte**
  aprobado, después el JSON y las reglas globales. Eso invierte el orden que
  declaran el propio handoff y el manual, que ponen el arte primero.
- Cada componente, historia o prueba conserva `screen_code + state_code +
  original_filename`.
- Textos en **voseo** (D-35), aunque el arte esté en usted: la adaptación de
  cada frase está en `ANALISIS.md` §6.
