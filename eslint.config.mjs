import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import { defineConfig, globalIgnores } from "eslint/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// eslint-config-next todavía exporta sus configs en formato eslintrc legacy
// (objetos { extends: [...] }), no como arrays de flat config. FlatCompat
// las traduce al formato que espera ESLint 9.
const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = defineConfig([
  ...compat.extends("eslint-config-next/core-web-vitals", "eslint-config-next/typescript"),
  // Override default ignores de eslint-config-next.
  globalIgnores([
    // Default ignores de eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Artefactos de Playwright (reportes y trazas incluyen JS empaquetado).
    "playwright-report/**",
    "test-results/**",
    // Worktrees de git: son **otras copias del repo**, con su propio ciclo de
    // vida y su propio lint. Sin esto, cualquier worktree con un build hecho
    // adentro rompe `npm run lint` del repo principal —los ignores de arriba
    // son relativos a la raíz, así que `next-env.d.ts` y `.next/**` no tapan
    // los del worktree— y el error aparece en un archivo generado que nadie
    // tocó, lo cual manda a buscar el problema al lugar equivocado.
    ".claude/worktrees/**",
  ]),
  // Regla dura de CLAUDE.md: "nada llama al SDK de DynamoDB o S3 fuera de
  // src/repositories/" (y, por extensión, ningún SDK de AWS en general —
  // Secrets Manager incluido). Se aplica acá para que violarla sea un error
  // de lint, no solo una convención documentada.
  //
  // `src/adapters/` queda fuera porque CLAUDE.md tiene **dos** reglas de
  // importación, no una: el acceso a datos va por `src/repositories/`, y los
  // SDK de proveedores externos van por `src/adapters/`. Un SDK de servicio de
  // AWS que es un *proveedor* del flujo —Rekognition para la biometría de P5,
  // Textract para el OCR— es lo segundo, no lo primero, y su lugar correcto es
  // el adaptador. Los de acceso a datos siguen prohibidos ahí (ver abajo).
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/repositories/**", "src/adapters/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@aws-sdk/*", "@aws-sdk"],
              message:
                "El SDK de AWS solo se puede importar desde src/repositories/ (acceso a datos) o src/adapters/ (proveedores externos), según CLAUDE.md. " +
                "Si necesitás DynamoDB o S3 acá, agregá o extendé un repositorio en src/repositories/ y consumilo desde ahí.",
            },
          ],
        },
      ],
    },
  },
  // Contracara de lo anterior: un adaptador puede hablar con el SDK de su
  // proveedor, pero **no** con el de la base ni el del almacenamiento. Si un
  // adaptador necesitara persistir algo, va por un repositorio, igual que
  // todos los demás.
  {
    files: ["src/adapters/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@aws-sdk/client-dynamodb",
                "@aws-sdk/lib-dynamodb",
                "@aws-sdk/client-s3",
                "@aws-sdk/client-secrets-manager",
              ],
              message:
                "Un adaptador puede importar el SDK de su proveedor externo, pero el acceso a datos (DynamoDB, S3, Secrets Manager) va por src/repositories/ (CLAUDE.md, regla dura de acceso a datos).",
            },
          ],
        },
      ],
    },
  },
  // Segunda mitad de la misma regla dura de CLAUDE.md: "ningún archivo fuera
  // de src/adapters/ puede [...] hacer fetch a una API externa". Se restringe
  // solo en la superficie de servidor, donde una llamada saliente sería una
  // integración externa esquivando su puerto. No se restringe en componentes
  // de cliente, donde `fetch` contra los propios Route Handlers es legítimo.
  {
    files: [
      "src/domain/**/*.{ts,tsx}",
      "src/ports/**/*.{ts,tsx}",
      "src/repositories/**/*.{ts,tsx}",
      "src/app/api/**/*.{ts,tsx}",
    ],
    rules: {
      "no-restricted-globals": [
        "error",
        {
          name: "fetch",
          message:
            "Las llamadas a APIs externas viven solo en src/adapters/ (CLAUDE.md, regla dura de puertos y adaptadores). " +
            "Definí la operación en el puerto correspondiente de src/ports/ y consumila desde ahí, así el mock y la " +
            "implementación oficial comparten los mismos tests de contrato.",
        },
      ],
    },
  },
  // CLAUDE.md, "Qué no hacer": "No uses `any` en TypeScript. El dominio del
  // expediente es tipado estricto." eslint-config-next deja esta regla en
  // warning; acá es error, porque un `any` en el dominio del expediente
  // desactiva justamente las garantías de la máquina de estados.
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
]);

export default eslintConfig;
