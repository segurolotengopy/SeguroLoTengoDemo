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
import type { MessagingProvider } from "../ports/messaging-provider";
import type { OtpRepository } from "../repositories/otp-repository";
import { SESv2Client } from "@aws-sdk/client-sesv2";
import type { LectorMetadataOtp } from "../domain/verificacion-canal";
import type { IntegracionEvidencia } from "../domain/evidencia";
import { PAISES_ACEPTADOS_POR_DEFECTO } from "../domain/documento-regional";
import type { PaisDocumento } from "../domain/documento-regional";
import { resolverAdaptador, resolverModoIntegracion } from "./index";
import type { NombrePuerto } from "./index";
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
import { obtenerOtpPepper, obtenerWhatsAppModularToken } from "../repositories/secrets-client";
import { crearAlmacenEstadoDemo } from "../repositories";
import { crearIdentityProviderMock } from "./mock/identity-provider";
import { crearOtpProviderMock } from "./mock/otp-provider";
import type { OtpFirmaRemoto } from "./mock/signature-provider";
import { crearMessagingProviderMock } from "./mock/messaging-provider";
import { crearPaymentProviderMock } from "./mock/payment-provider";
import { crearPolicyIssuerMock } from "./mock/policy-issuer";
import { crearRegistroCivilMock } from "./mock/registro-civil";
import {
  configurarAlmacenFirmaDemo,
  configurarPepperFirmaDemo,
  crearSignatureProviderMock,
} from "./mock/signature-provider";
import { consumirFallaDemo } from "./mock/fallas-demo";
import { plazoPagoMs } from "./mock/plazo-pago-demo";

/**
 * Persistencia del simulador de firma, configurada al importar este módulo.
 *
 * Va acá y no dentro de una función porque las operaciones del firmador
 * simulado son funciones de módulo que los Route Handlers llaman directo
 * (`abrirEnlaceDeFirmaMock`, `firmarEnCode100Mock`), sin pedirle nada al
 * composition root. Todo camino que las alcanza importa igual este archivo,
 * así que configurarlas en el import es lo que garantiza que nadie las use sin
 * almacén.
 *
 * **Por qué hace falta:** las sesiones vivían en memoria del proceso y el
 * cómputo de Amplify es serverless. Desplegado, la sesión creada al enviar el
 * enlace no existía al abrir el firmador y P8 no se podía completar. El pepper
 * tenía el mismo problema: uno por instancia hacía que un código emitido en
 * una no se pudiera verificar en otra.
 */
configurarAlmacenFirmaDemo(crearAlmacenEstadoDemo());
// Sin secret configurado —`next dev` sin AWS— se queda con el pepper por
// proceso, que ahí es correcto porque hay un solo proceso.
configurarPepperFirmaDemo(process.env.APP_SECRETS_ARN ? obtenerOtpPepper : null);

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
        cliente: crearClienteWhatsAppModularDesdeEntorno(process.env, obtenerWhatsAppModularToken),
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
    live: () => crearOtpFirmaRemotoWhatsAppModular(crearClienteWhatsAppModularDesdeEntorno(process.env, obtenerWhatsAppModularToken)),
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
      }),
    live: () => {
      throw new Error(
        "INTEGRATION_PAYMENT=live pero todavía no existe el adaptador oficial de PaymentProvider " +
          "(src/adapters/live/). Ver docs/Integraciones/ para los contratos de Bancard.",
      );
    },
  });
}

/**
 * Entrega de documentos por los canales verificados (CHG-44, CMP-05).
 *
 * Solo hay mock, y el `live` no es una tarea pendiente cualquiera: WhatsApp-
 * Modular expone hoy un `otp-service` y ningún endpoint para mandar un
 * documento, así que **no hay contrato que implementar**. Inventarlo sería
 * inventar la integración, el mismo criterio con el que el webhook de Code100
 * quedó declarado y sin implementar (PEN-02). El de correo sí es escribible
 * sobre SES cuando la entrega salga del demo.
 */
export function obtenerMessagingProvider(): MessagingProvider {
  return resolverAdaptador("MESSAGING", {
    mock: () => crearMessagingProviderMock(),
    live: () => {
      throw new Error(
        "INTEGRATION_MESSAGING=live pero todavía no existe el adaptador oficial de " +
          "MessagingProvider. WhatsApp-Modular no expone hoy un endpoint de entrega de " +
          "documentos; ver la cabecera de src/ports/messaging-provider.ts.",
      );
    },
  });
}

/** Vigencia del enlace de firma de Code100: 24 horas (fila 41 de la matriz). */
const VIGENCIA_ENLACE_FIRMA_MS = 24 * 60 * 60 * 1000;

export function obtenerSignatureProvider(): SignatureProvider {
  return resolverAdaptador("SIGNATURE", {
    // La vigencia del enlace de firma es **suya**, no la del expediente.
    //
    // Estaban atadas —`vigenciaEnlaceMs: plazoPagoMs()`— y tenía sentido
    // mientras el plazo del panel fuera el de *firmar*: comprimirlo a segundos
    // debía comprimir también el enlace, o el vencimiento no vencía. Con la
    // inversión (D-08) ese plazo pasó a ser el de **pagar**, y la atadura
    // quedó al revés: acortar el plazo de pago acortaba la ventana para
    // firmar, que es un paso anterior. En la batería E2E el escenario del
    // vencimiento quedaba con 30 segundos para completar todo el acto de
    // Code100.
    //
    // Son dos caducidades distintas y ahora se las trata así: el enlace vive
    // 24 horas (fila 41 de la matriz), y el plazo de pago lo fija D-10.
    mock: () =>
      crearSignatureProviderMock({
        vigenciaEnlaceMs: VIGENCIA_ENLACE_FIRMA_MS,
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

/**
 * Cómo se describe cada integración en el visor de evidencia (panel de demo y
 * consola administrativa).
 *
 * Vive acá porque el composition root es **el único** que sabe qué adaptador
 * quedó activo. Antes el visor rotulaba todo como
 * `<proveedor previsto> (mock en demo)`, un literal fijo: con los canales
 * reales habilitados eso pasó a ser falso, y una consola de cumplimiento que
 * afirma "mock" sobre una llamada que salió de verdad es peor que una sin
 * rótulo — el auditor la lee al revés.
 *
 * Se resuelve en el servidor y baja como prop: el visor es un componente de
 * cliente y no puede —ni debe— leer variables de entorno.
 */
export function describirIntegraciones(): Record<IntegracionEvidencia, string> {
  const describir = (puerto: NombrePuerto, previsto: string, enVivo: () => string): string =>
    resolverModoIntegracion(puerto) === "live" ? enVivo() : `${previsto} · simulado`;

  return {
    OtpProvider: describir("OTP", "Infobip", () =>
      modoOtpEmail() === "live"
        ? "WhatsApp-Modular + Amazon SES · real"
        : "WhatsApp-Modular · real, correo simulado",
    ),
    IdentityProvider: describir("IDENTITY", "Entrust/Onfido", () =>
      // La distinción importa: el camino con cámara no hace prueba de vida y
      // usa el umbral facial de demostración. Rotularlo igual que el de
      // producción escondería justo lo que un auditor necesita ver.
      modoSelfie() === "camara-demo"
        ? "AWS Rekognition + Textract · real, política de demostración"
        : "AWS Rekognition + Textract · real",
    ),
    PaymentProvider: describir("PAYMENT", "Bancard", () => "Bancard · real"),
    SignatureProvider: describir("SIGNATURE", "Code100", () => "Code100 · real"),
    PolicyIssuer: describir("POLICY", "SEBAOT (Alianza)", () => "SEBAOT (Alianza) · real"),
  };
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
 * Plazo para pagar que rige en este proceso: 24 horas, o lo que haya fijado
 * el panel de demo con `DEMO_MODE=true` (`mock/plazo-pago-demo.ts`).
 *
 * Se expone desde el composition root —y no importando el módulo mock desde
 * `src/app/`— por la misma razón que los proveedores: los Route Handlers del
 * flujo no tienen por qué saber que existe un modo demo.
 */
export function obtenerPlazoPagoMs(): number {
  return plazoPagoMs();
}

/**
 * `true` una sola vez si el panel armó la falla de firmas institucionales.
 *
 * Se expone desde el composition root por la misma razón que los proveedores:
 * la pantalla de firma no tiene por qué saber que existe un modo demo, y en un
 * despliegue normal `consumirFallaDemo` devuelve siempre `false`.
 */
export function firmasInstitucionalesCaidas(): boolean {
  return consumirFallaDemo("FIRMAS_INSTITUCIONALES_FALLAN");
}
