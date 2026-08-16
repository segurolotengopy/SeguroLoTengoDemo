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
import { SESv2Client } from "@aws-sdk/client-sesv2";
import type { LectorMetadataOtp } from "../domain/verificacion-canal";
import { PAISES_ACEPTADOS_POR_DEFECTO } from "../domain/documento-regional";
import type { PaisDocumento } from "../domain/documento-regional";
import { resolverAdaptador } from "./index";
import { crearIdentityProviderAws } from "./live/identity-provider";
import { crearIdentityProviderCamaraDemo } from "./live/identity-provider-camara";
import {
  crearEnviadorSes,
  crearOtpProviderCorreoSes,
  dividirOtpPorCanal,
} from "./live/otp-provider-correo-ses";
import {
  crearOtpFirmaRemotoWhatsAppModular,
  crearOtpProviderWhatsAppModular,
  lectorConMetadataWhatsAppModular,
} from "./live/otp-provider";
import { crearClienteWhatsAppModularDesdeEntorno } from "./live/whatsapp-modular";
import { crearIdentityProviderMock } from "./mock/identity-provider";
import { crearOtpProviderMock } from "./mock/otp-provider";
import type { OtpFirmaRemoto } from "./mock/signature-provider";
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
/**
 * Flag granular del OTP de correo, aparte de `INTEGRATION_OTP`: el canal de
 * WhatsApp (WhatsApp-Modular) y el de correo (Amazon SES) se habilitan por
 * separado porque dependen de credenciales distintas — Meta de un lado, la
 * identidad SES verificada del otro. `INTEGRATION_OTP_EMAIL=live` exige
 * `OTP_EMAIL_FROM` (remitente verificado en SES); cualquier otro valor deja
 * el correo en mock.
 */
function modoOtpEmail(): "mock" | "live" {
  return process.env.INTEGRATION_OTP_EMAIL === "live" ? "live" : "mock";
}

function crearCorreoSesDesdeEntorno(otpRepository: OtpRepository): OtpProvider {
  const remitente = process.env.OTP_EMAIL_FROM;
  if (!remitente) {
    throw new Error(
      "INTEGRATION_OTP_EMAIL=live requiere OTP_EMAIL_FROM (remitente verificado en Amazon SES).",
    );
  }
  const region = process.env.AWS_REGION ?? "us-east-1";
  return crearOtpProviderCorreoSes({
    otpRepository,
    enviador: crearEnviadorSes({ cliente: new SESv2Client({ region }), remitente }),
  });
}

export function obtenerOtpProvider(otpRepository: OtpRepository): OtpProvider {
  const mock = () =>
    crearOtpProviderMock({
      otpRepository,
      fallaForzada: () => {
        if (consumirFallaDemo("OTP_EXPIRADO")) return "EXPIRADO";
        if (consumirFallaDemo("OTP_INTENTOS_AGOTADOS")) return "INTENTOS_AGOTADOS";
        return null;
      },
    });

  // El OTP de correo (P4) por Amazon SES (ítem 4 de la tabla, Infobip como
  // backup) — independiente del canal de WhatsApp.
  const correo = () => (modoOtpEmail() === "live" ? crearCorreoSesDesdeEntorno(otpRepository) : mock());

  return resolverAdaptador("OTP", {
    // Celular en mock: si el correo está en live, se divide por canal (el
    // canal persistido del OTP decide quién verifica y reenvía).
    mock: () =>
      modoOtpEmail() === "live"
        ? dividirOtpPorCanal({ celular: mock(), correo: correo(), otpRepository })
        : mock(),
    // WhatsApp-Modular (ítem 3 de la tabla de integraciones): el OTP de P1
    // sale de verdad por el `otp-service` (Meta Cloud API o su dry-run). El
    // de P4 va por SES si está habilitado; si no, por el mock.
    live: () =>
      crearOtpProviderWhatsAppModular({
        cliente: crearClienteWhatsAppModularDesdeEntorno(),
        correo: correo(),
      }),
  });
}

/**
 * `LectorMetadataOtp` que acompaña a `obtenerOtpProvider`: en modo mock es el
 * propio repositorio (los OTP viven en DynamoDB); en modo live, primero la
 * metadata de los OTP emitidos por WhatsApp-Modular y después el repositorio
 * (P4). `_dependencias.ts` de P1/P4 debe pedir los dos acá, nunca armarlos
 * por separado, para que provider y lector siempre hablen del mismo universo
 * de `otpId`.
 */
export function obtenerLectorOtp(otpRepository: OtpRepository): LectorMetadataOtp {
  return resolverAdaptador("OTP", {
    mock: () => otpRepository,
    live: () => lectorConMetadataWhatsAppModular(otpRepository),
  });
}

/**
 * Delegado del OTP de firma simulada (P8): `null` en modo mock (el código lo
 * emite la sesión simulada y se lee en el panel de demo), WhatsApp-Modular
 * con propósito `SIGNATURE_P7A` cuando `INTEGRATION_OTP=live`. Es la misma
 * palanca que P1 a propósito: "los OTP que viajan por WhatsApp salen por
 * WhatsApp-Modular" es una sola decisión, no dos.
 */
export function obtenerOtpFirmaRemoto(): OtpFirmaRemoto | null {
  return resolverAdaptador<OtpFirmaRemoto | null>("OTP", {
    mock: () => null,
    live: () => crearOtpFirmaRemotoWhatsAppModular(crearClienteWhatsAppModularDesdeEntorno()),
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
      const clientes = {
        rekognition: new RekognitionClient({ region }),
        textract: new TextractClient({ region }),
      };

      return modoSelfie() === "camara-demo"
        ? crearIdentityProviderCamaraDemo({ ...clientes, paisesAceptados: paisesDeCedulaAceptados() })
        : crearIdentityProviderAws(clientes);
    },
  });
}

/**
 * Cómo se toma la selfie en `INTEGRATION_IDENTITY=live`.
 *
 * - `liveness` (default) — Rekognition Face Liveness: sesión de streaming del
 *   navegador al proveedor. Es el camino de producción y el único con prueba
 *   de vida real.
 * - `camara-demo` — foto de la cámara del navegador, sin prueba de vida, con
 *   umbral facial de demostración y OCR aproximado. Existe para demostrar el
 *   recorrido con cédulas reales a distancia; el propio adaptador exige
 *   `DEMO_MODE=true` y tira si no lo está.
 *
 * Es una variable aparte y no un tercer valor de `INTEGRATION_IDENTITY` a
 * propósito: `mock`/`live` responde "¿hay un proveedor externo de verdad del
 * otro lado?", y en los dos casos de acá la respuesta es sí (Rekognition y
 * Textract, con costo real). Lo que cambia es el rigor del control, que es
 * otra pregunta.
 */
function modoSelfie(): "liveness" | "camara-demo" {
  return process.env.INTEGRATION_IDENTITY_SELFIE === "camara-demo" ? "camara-demo" : "liveness";
}

/**
 * Países cuya cédula acepta el camino de demostración, vía
 * `IDENTITY_PAISES_CEDULA` (por ejemplo `PY,BO`).
 *
 * Por defecto, solo Paraguay: es lo que dice `docs/ESPECIFICACION_PANTALLAS.md`
 * para P5 ("No se admite pasaporte ni documento extranjero"). Aceptar cédula
 * boliviana es una **decisión de demostración**, sin fila que la respalde en la
 * matriz de cumplimiento, y por eso hay que pedirla explícitamente en el
 * entorno en vez de heredarla.
 */
export function paisesDeCedulaAceptados(): readonly PaisDocumento[] {
  const declarados = (process.env.IDENTITY_PAISES_CEDULA ?? "")
    .split(",")
    .map((valor) => valor.trim().toUpperCase())
    .filter((valor): valor is PaisDocumento => valor === "PY" || valor === "BO");

  return declarados.length > 0 ? declarados : PAISES_ACEPTADOS_POR_DEFECTO;
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
