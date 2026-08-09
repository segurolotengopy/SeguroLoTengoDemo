#!/usr/bin/env node
/**
 * `npm run test:e2e` está documentado en CLAUDE.md (sección Comandos) como
 * "Playwright, escenarios completos", pero Playwright todavía no está
 * instalado ni hay escenarios escritos: las pantallas P0–P9 no existen.
 *
 * Este stub existe para que el comando documentado no mienta. Antes fallaba
 * con "Missing script", que es ambiguo — se puede leer como un error de
 * entorno. Ahora falla diciendo exactamente qué falta y por qué, y falla con
 * código distinto de cero para que ningún pipeline pueda interpretar un E2E
 * inexistente como un E2E que pasó.
 *
 * Al implementar Playwright: reemplazar este archivo por el runner real y
 * apuntar el script de package.json ahí.
 */
console.error(
  [
    "",
    "  npm run test:e2e — todavía no implementado.",
    "",
    "  CLAUDE.md documenta este comando como los escenarios E2E de Playwright,",
    "  pero Playwright no está entre las dependencias y no hay escenarios: el",
    "  flujo P0–P9 no está construido todavía.",
    "",
    "  Esto NO es un fallo de tu entorno. Los tests que sí existen corren con:",
    "",
    "      npm test",
    "",
    "  Tarea pendiente (Fase 5 del plan de CI/CD): instalar @playwright/test y",
    "  escribir los escenarios de camino feliz, derivación a Pantalla A y",
    "  vencimiento a Pantalla B, con las personas de src/adapters/mock/personas.ts.",
    "",
  ].join("\n"),
);

process.exit(1);
