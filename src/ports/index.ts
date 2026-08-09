/**
 * Reexporta las 7 interfaces de proveedores externos y sus tipos
 * auxiliares, para poder importar todo desde `@/ports` (o `../ports`).
 *
 * Regla dura (CLAUDE.md): ningún archivo fuera de `src/adapters/` puede
 * importar un SDK de proveedor externo ni hacer fetch a una API externa.
 * Todo consumo pasa por estos puertos.
 */
export * from "./otp-provider";
export * from "./identity-provider";
export * from "./compliance-provider";
export * from "./payment-provider";
export * from "./signature-provider";
export * from "./policy-issuer";
export * from "./evidence-store";
