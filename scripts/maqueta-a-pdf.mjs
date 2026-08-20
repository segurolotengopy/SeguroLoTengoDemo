#!/usr/bin/env node
/**
 * Imprime una maqueta HTML a PDF con el Chromium que ya trae Playwright.
 *
 * Es la contracara de `armar-pdf-pantallas.py`, y la diferencia importa: aquel
 * junta **capturas de la aplicación** —sirve para mostrar lo que ya está
 * implementado—, y este imprime **el dibujo previo**, que es lo que se manda a
 * aprobar antes de escribir una línea de pantalla.
 *
 * El corte de página lo decide el CSS de la maqueta (`@page` + `break-after`),
 * no este script: una pantalla por hoja apaisada. Por eso va
 * `preferCSSPageSize`.
 *
 * Uso:  node scripts/maqueta-a-pdf.mjs [entrada.html] [salida.pdf]
 */

import { chromium } from "@playwright/test";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { stat } from "node:fs/promises";

const RAIZ = resolve(import.meta.dirname, "..");

const entrada = resolve(
  RAIZ,
  process.argv[2] ?? "pantallas/maqueta/maqueta-pasos-1-3.html",
);
const salida = resolve(
  RAIZ,
  process.argv[3] ?? "pantallas/SeguroLoTengo-maqueta-aprobacion-pasos-1-3.pdf",
);

const navegador = await chromium.launch();
const pagina = await navegador.newPage();

await pagina.goto(pathToFileURL(entrada).href, { waitUntil: "networkidle" });
// Las tipografías llegan de Google Fonts: sin esperarlas, la primera hoja sale
// con la fuente de reserva y las medidas no son las que se aprueban.
await pagina.evaluate(() => document.fonts.ready);

await pagina.pdf({
  path: salida,
  preferCSSPageSize: true,
  printBackground: true,
});

await navegador.close();

const { size } = await stat(salida);
console.log(`${salida} · ${(size / 1024).toFixed(0)} kB`);
