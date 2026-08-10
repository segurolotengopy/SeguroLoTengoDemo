/**
 * Composition root de adaptadores: resuelve qué implementación de cada
 * puerto se usa, según `INTEGRATION_MODE` / `INTEGRATION_<PUERTO>`
 * (`src/adapters/index.ts`).
 *
 * `index.ts` deliberadamente no conoce las implementaciones concretas; este
 * archivo sí, y es el único lugar donde un Route Handler pide "el proveedor
 * de OTP" sin saber si detrás hay un mock o Infobip.
 *
 * `src/adapters/live/` está vacío todavía: pedir modo `live` falla con un
 * error explícito en vez de caer silenciosamente al mock, que sería la peor
 * forma de enterarse en producción.
 */
import type { IdentityProvider } from "../ports/identity-provider";
import type { OtpProvider } from "../ports/otp-provider";
import type { PaymentProvider } from "../ports/payment-provider";
import type { OtpRepository } from "../repositories/otp-repository";
import { resolverAdaptador } from "./index";
import { crearIdentityProviderMock } from "./mock/identity-provider";
import { crearOtpProviderMock } from "./mock/otp-provider";
import { crearPaymentProviderMock } from "./mock/payment-provider";

export function obtenerOtpProvider(otpRepository: OtpRepository): OtpProvider {
  return resolverAdaptador("OTP", {
    mock: () => crearOtpProviderMock({ otpRepository }),
    live: () => {
      throw new Error(
        "INTEGRATION_OTP=live pero todavía no existe el adaptador oficial de OtpProvider " +
          "(src/adapters/live/). Ver docs/Tabla de Integraciones externas - Tabla.csv.",
      );
    },
  });
}

export function obtenerIdentityProvider(): IdentityProvider {
  return resolverAdaptador("IDENTITY", {
    mock: () => crearIdentityProviderMock(),
    live: () => {
      throw new Error(
        "INTEGRATION_IDENTITY=live pero todavía no existe el adaptador oficial de IdentityProvider " +
          "(src/adapters/live/). Ver docs/Tabla de Integraciones externas - Tabla.csv.",
      );
    },
  });
}

export function obtenerPaymentProvider(): PaymentProvider {
  return resolverAdaptador("PAYMENT", {
    mock: () => crearPaymentProviderMock(),
    live: () => {
      throw new Error(
        "INTEGRATION_PAYMENT=live pero todavía no existe el adaptador oficial de PaymentProvider " +
          "(src/adapters/live/). Ver docs/Integraciones/ para los contratos de Bancard.",
      );
    },
  });
}
