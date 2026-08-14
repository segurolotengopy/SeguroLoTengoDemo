/**
 * Composition root de adaptadores: resuelve qué implementación de cada
 * puerto se usa, según `INTEGRATION_MODE` / `INTEGRATION_<PUERTO>`
 * (`src/adapters/index.ts`).
 *
 * `index.ts` deliberadamente no conoce las implementaciones concretas; este
 * archivo sí, y es el único lugar donde un Route Handler pide "el proveedor
 * de OTP" sin saber si detrás hay un mock o Infobip.
 *
 * Los puertos que todavía no tienen adaptador oficial fallan con un error
 * explícito al pedir modo `live`, en vez de caer silenciosamente al mock, que
 * sería la peor forma de enterarse en producción. `IDENTITY` ya lo tiene
 * (AWS Rekognition + Textract).
 */
import { RekognitionClient } from "@aws-sdk/client-rekognition";
import { TextractClient } from "@aws-sdk/client-textract";
import type { IdentityProvider } from "../ports/identity-provider";
import type { OtpProvider } from "../ports/otp-provider";
import type { PaymentProvider } from "../ports/payment-provider";
import type { RegistroCivilProvider } from "../ports/registro-civil";
import type { PolicyIssuer } from "../ports/policy-issuer";
import type { SignatureProvider } from "../ports/signature-provider";
import type { OtpRepository } from "../repositories/otp-repository";
import { resolverAdaptador } from "./index";
import { crearIdentityProviderAws } from "./live/identity-provider";
import { crearIdentityProviderMock } from "./mock/identity-provider";
import { crearOtpProviderMock } from "./mock/otp-provider";
import { crearPaymentProviderMock } from "./mock/payment-provider";
import { crearPolicyIssuerMock } from "./mock/policy-issuer";
import { crearRegistroCivilMock } from "./mock/registro-civil";
import { crearSignatureProviderMock } from "./mock/signature-provider";
import { consumirFallaDemo } from "./mock/fallas-demo";
import { plazoFirmaMs } from "./mock/plazo-firma-demo";

/**
 * Las cuatro palancas de "forzar fallos puntuales" del panel de demo se
 * enchufan acá y solo acá (`mock/fallas-demo.ts`). Con `DEMO_MODE` apagado
 * `consumirFallaDemo` devuelve siempre `false`, así que en un despliegue normal
 * estas funciones son constantes: ningún adaptador puede fallar por esta vía.
 */
export function obtenerOtpProvider(otpRepository: OtpRepository): OtpProvider {
  return resolverAdaptador("OTP", {
    mock: () =>
      crearOtpProviderMock({
        otpRepository,
        fallaForzada: () => {
          if (consumirFallaDemo("OTP_EXPIRADO")) return "EXPIRADO";
          if (consumirFallaDemo("OTP_INTENTOS_AGOTADOS")) return "INTENTOS_AGOTADOS";
          return null;
        },
      }),
    live: () => {
      throw new Error(
        "INTEGRATION_OTP=live pero todavía no existe el adaptador oficial de OtpProvider " +
          "(src/adapters/live/). Ver docs/Tabla de Integraciones externas - Tabla.csv.",
      );
    },
  });
}

/**
 * `IdentityProvider` de P5.
 *
 * En modo `live` es AWS Rekognition + Textract (ítems 31 y 32 de la tabla de
 * integraciones). Los clientes del SDK se construyen acá, dentro del factory, y
 * no a nivel de módulo: importar este archivo en modo `mock` —que es lo que
 * hace toda la demo— no tiene por qué instanciar clientes de AWS ni resolver
 * credenciales.
 *
 * La región sale de `AWS_REGION`, que Amplify expone en el runtime de cómputo.
 * Ojo: **Face Liveness solo existe en `us-east-1`, `us-west-2`, `eu-west-1`,
 * `ap-northeast-1` y `ap-south-1`** — no hay región sudamericana, así que una
 * selfie de un cliente paraguayo sale del continente y esa transferencia
 * internacional de datos biométricos hay que declararla (Ley 7593/2025).
 */
export function obtenerIdentityProvider(): IdentityProvider {
  return resolverAdaptador("IDENTITY", {
    mock: () => crearIdentityProviderMock(),
    live: () => {
      const region = process.env.AWS_REGION ?? "us-east-1";
      return crearIdentityProviderAws({
        rekognition: new RekognitionClient({ region }),
        textract: new TextractClient({ region }),
      });
    },
  });
}

/**
 * `RegistroCivilProvider` (ítem 33) — la consulta al Departamento de
 * Identificaciones que le da salida a la cédula del formato anterior.
 *
 * No hay adaptador oficial y **no se puede escribir todavía**: no existe el
 * contrato de API del proveedor (convenio directo o intermediario tipo Didit),
 * e inventar endpoints es exactamente lo que CLAUDE.md prohíbe. Misma
 * situación que Code100 y Bancard.
 */
export function obtenerRegistroCivilProvider(): RegistroCivilProvider {
  return resolverAdaptador("REGISTRO_CIVIL", {
    mock: () =>
      crearRegistroCivilMock({
        caido: () => consumirFallaDemo("REGISTRO_CIVIL_CAIDO"),
      }),
    live: () => {
      throw new Error(
        "INTEGRATION_REGISTRO_CIVIL=live pero todavía no existe el adaptador oficial de " +
          "RegistroCivilProvider (src/adapters/live/). Hace falta el contrato de API del " +
          "proveedor: ver ítem 33 de docs/Tabla de Integraciones externas - Tabla.csv.",
      );
    },
  });
}

export function obtenerPaymentProvider(): PaymentProvider {
  return resolverAdaptador("PAYMENT", {
    mock: () =>
      crearPaymentProviderMock({
        fallaForzada: () => (consumirFallaDemo("BANCARD_TIMEOUT") ? "TIMEOUT" : null),
        fallaCapturaForzada: () =>
          consumirFallaDemo("BANCARD_CAPTURA_FALLIDA") ? "CAPTURA_FALLIDA" : null,
      }),
    live: () => {
      throw new Error(
        "INTEGRATION_PAYMENT=live pero todavía no existe el adaptador oficial de PaymentProvider " +
          "(src/adapters/live/). Ver docs/Integraciones/ para los contratos de Bancard.",
      );
    },
  });
}

export function obtenerSignatureProvider(): SignatureProvider {
  return resolverAdaptador("SIGNATURE", {
    // La vigencia del enlace acompaña al plazo para firmar: si el panel de
    // demo comprime las 24 horas a segundos, un enlace que siguiera vivo un
    // día entero mostraría un vencimiento que no vence.
    mock: () =>
      crearSignatureProviderMock({
        vigenciaEnlaceMs: plazoFirmaMs(),
        fallaForzada: () => (consumirFallaDemo("CODE100_RECHAZO") ? "RECHAZADA" : null),
      }),
    live: () => {
      throw new Error(
        "INTEGRATION_SIGNATURE=live pero todavía no existe el adaptador oficial de SignatureProvider " +
          "(src/adapters/live/). Ver docs/Integraciones/Documentacion Firmador - API FLOW.pdf.",
      );
    },
  });
}

export function obtenerPolicyIssuer(): PolicyIssuer {
  return resolverAdaptador("POLICY", {
    mock: () => crearPolicyIssuerMock(),
    live: () => {
      throw new Error(
        "INTEGRATION_POLICY=live pero todavía no existe el adaptador oficial de PolicyIssuer " +
          "(src/adapters/live/). Ver docs/Tabla de Integraciones externas - Tabla.csv (SEBAOT).",
      );
    },
  });
}

/**
 * Plazo para firmar que rige en este proceso: 24 horas, o lo que haya fijado
 * el panel de demo con `DEMO_MODE=true` (`mock/plazo-firma-demo.ts`).
 *
 * Se expone desde el composition root —y no importando el módulo mock desde
 * `src/app/`— por la misma razón que los proveedores: los Route Handlers del
 * flujo no tienen por qué saber que existe un modo demo.
 */
export function obtenerPlazoFirmaMs(): number {
  return plazoFirmaMs();
}
