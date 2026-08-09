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
  ]),
  // Regla dura de CLAUDE.md: "nada llama al SDK de DynamoDB o S3 fuera de
  // src/repositories/" (y, por extensión, ningún SDK de AWS en general —
  // Secrets Manager incluido). Se aplica acá para que violarla sea un error
  // de lint, no solo una convención documentada.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/repositories/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@aws-sdk/*", "@aws-sdk"],
              message:
                "El SDK de AWS solo se puede importar desde src/repositories/ (CLAUDE.md, regla dura de acceso a datos). " +
                "Si necesitás DynamoDB o S3 acá, agregá o extendé un repositorio en src/repositories/ y consumilo desde ahí.",
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
