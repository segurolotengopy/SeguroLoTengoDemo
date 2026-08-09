import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Mismo alias que `tsconfig.json` (`@/*` → `./src/*`), para que los tests
    // puedan importar y mockear módulos por la misma ruta que usa el código
    // de la app (necesario para `vi.mock("@/app/api/p1/_dependencias")`).
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
