/**
 * Adaptador mock de `SignatureProvider` (P8 · Revisión y firma final).
 *
 * Simula a Code100 (`docs/Tabla de Integraciones externas - Tabla.csv`, firma
 * electrónica) sin salir a la red: no hay `fetch`, no hay credenciales, no hay
 * certificados. Reproduce el flujo que documenta
 * `docs/Integraciones/Documentacion Firmador - API FLOW.pdf` con los mismos
 * momentos, aunque sin sus endpoints:
 *
 *   - `iniciarFirma` ≈ `POST /signature/auth` + `GET /signature/session-start`:
 *     abre **una** sesión con los dos documentos adentro y devuelve el
 *     `session_id` y el `_authUrl` que se le manda a la persona.
 *   - abrir el enlace ≈ que la persona entre al `_authUrl`: ahí Code100 emite
 *     el OTP de firma y lo pide en su propia pantalla.
 *   - firmar ≈ `POST /signature/sign-pdf`: devuelve los dos PDF firmados.
 *   - `confirmarResultado` ≈ `POST /signature/getSessionId`: el estado.
 *
 * ## Regla inviolable #3 — o los dos, o ninguno
 *
 * El sellado calcula las dos huellas firmadas **antes** de escribir nada, y
 * después las asienta en una sola asignación (`sesion.firma`). No hay ningún
 * instante en el que la sesión tenga la Solicitud firmada y el FIPF no: si la
 * simulación falla en el medio —palanca `fallarAMitadDelSellado`, que existe
 * justamente para poder probarlo— la sesión queda sin firma, con las dos
 * huellas originales intactas y el acto reintentable. Ver
 * `__tests__/signature-provider.test.ts`.
 *
 * ## Regla inviolable #2 — el OTP de firma
 *
 * El tercer OTP del flujo (celular en P1, correo en P4, firma acá) es de
 * Code100: la persona lo tipea en la pantalla del proveedor. Este mock lo
 * genera para poder simularlo, pero lo trata igual que el repositorio trata a
 * los otros dos — persiste **solo el HMAC**, con un pepper propio del proceso,
 * y retiene el código en claro únicamente en el registro del panel de demo,
 * que se apaga con `DEMO_MODE`. Ningún método de `SignatureProvider` lo
 * devuelve: los tipos no tienen dónde ponerlo.
 *
 * ## Estado en memoria
 *
 * Mismo criterio que `payment-provider.ts`: las sesiones viven en un `Map` a
 * nivel de módulo porque cada Route Handler construye su propio adaptador por
 * request, y el panel de demo (otro handler) tiene que ver la sesión que abrió
 * el handler del flujo. Es una ayuda de demostración, no la evidencia
 * probatoria, que va por `EvidenceStore`.
 */
import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { crearDocumentoPdf } from "../../documentos/pdf";
import type {
  DocumentosFirmados,
  FirmaIniciada,
  IniciarFirmaInput,
  MotivoNoFirmado,
  ResultadoFirma,
  SignatureProvider,
} from "../../ports/signature-provider";
import { ErrorCode100 } from "../../ports/signature-provider";
import { INTENTOS_MAXIMOS_OTP, VIGENCIA_OTP_MS } from "../../domain/reglas-otp";
import { generarCodigoOtp } from "../../repositories/otp-hash";
import type { CanalFirma, DocumentoCerrado, Firma, PaqueteDocumental } from "../../domain/tipos";
import { estadoCompartidoDemo } from "./estado-compartido";

/**
 * Vigencia del enlace de firma: 24 horas (fila 41 de
 * `docs/Tabla Cumplimiento SeguroLo Tengo - Tabla.csv` — *"Establecer una
 * vigencia de 24 horas para el enlace de firma Code100"*, que la propia matriz
 * marca como no legal pero sí informable, Ley 4868/13, arts. 7(f), 7(n) y 7(r)).
 *
 * Es la vigencia del **enlace**, no del plazo del expediente: el plazo para
 * firmar vive en `Expediente.plazoFirmaVenceEn` y lo controla el dominio.
 */
export const VIGENCIA_ENLACE_FIRMA_MS = 24 * 60 * 60 * 1000;

/** Demora simulada del ida y vuelta con Code100 al abrir la sesión. */
export const DEMORA_ENVIO_ENLACE_MS = 900;

/** Falla que el panel de demo puede forzar al abrir el acto de firma. */
export type FallaCode100Demo = "TIMEOUT" | "RECHAZADA";

/**
 * Pepper del proceso para el HMAC del OTP de firma. No sale de Secrets
 * Manager como el de `OtpRepository`: acá se está simulando el almacén interno
 * de Code100, que es del proveedor y no nuestro. Aleatorio por arranque, así
 * ni siquiera entre reinicios queda un hash comparable.
 *
 * Anclado en `estadoCompartidoDemo` por la misma razón que `sesiones`: tiene
 * que ser **uno por proceso**, no uno por instancia de módulo. Si cada
 * recompilación de `next dev` acuñara un pepper nuevo mientras las sesiones
 * sobreviven en `globalThis`, un OTP emitido antes de la recompilación se
 * verificaría contra otro pepper y daría `CODIGO_INCORRECTO` sin que la
 * persona se haya equivocado.
 */
const PEPPER_DEL_PROCESO = estadoCompartidoDemo("firma.pepper", () =>
  randomBytes(32).toString("hex"),
);

function hmacOtp(codigo: string): string {
  return createHmac("sha256", PEPPER_DEL_PROCESO).update(codigo, "utf8").digest("hex");
}

function coincideConHash(codigoIngresado: string, hashPersistido: string): boolean {
  const calculado = Buffer.from(hmacOtp(codigoIngresado), "hex");
  const persistido = Buffer.from(hashPersistido, "hex");
  if (calculado.length !== persistido.length) return false;
  return timingSafeEqual(calculado, persistido);
}

/** OTP de firma vivo dentro de una sesión de Code100 simulada. */
interface OtpDeFirma {
  readonly hash: string;
  readonly emitidoEn: string;
  readonly expiraEn: string;
  intentos: number;
}

export interface SesionFirmaMock {
  readonly idCode100: string;
  readonly expedienteId: string;
  readonly canal: CanalFirma;
  readonly destino: string;
  readonly paquete: PaqueteDocumental;
  readonly enlaceEnviadoEn: string;
  readonly venceEn: string;
  readonly urlActoDeFirma: string;
  /** `null` hasta que la persona abre el enlace y Code100 emite el código. */
  otp: OtpDeFirma | null;
  /**
   * Única escritura del resultado firmado. O están las dos huellas (porque
   * `Firma` no admite menos) o no hay nada: regla inviolable #3.
   */
  firma: Firma | null;
  /** Los dos PDF firmados. Se escriben en la misma asignación que `firma`. */
  documentosFirmados: DocumentosFirmados | null;
  fallo: { readonly motivo: MotivoNoFirmado; readonly detalle: string | null } | null;
  actualizadoEn: string;
}

/** Lo que el panel de demo puede ver del OTP de firma de una sesión. */
export interface CodigoFirmaDemo {
  readonly idCode100: string;
  readonly codigo: string;
  readonly destino: string;
  readonly emitidoEn: string;
  readonly expiraEn: string;
}

const sesiones = estadoCompartidoDemo("firma.sesiones", () => new Map<string, SesionFirmaMock>());
const codigosDemo = estadoCompartidoDemo("firma.codigos-demo", () => new Map<string, CodigoFirmaDemo>());

export interface OpcionesSignatureProviderMock {
  readonly ahora?: () => Date;
  /** Espera real que simula el ida y vuelta con Code100. Los tests la pasan en 0. */
  readonly demoraEnvioEnlaceMs?: number;
  /** Vigencia del enlace; el panel de demo la comprime junto con el plazo de firma. */
  readonly vigenciaEnlaceMs?: number;
  /** Falla a forzar en el próximo `iniciarFirma` (palanca del panel de demo). */
  readonly fallaForzada?: () => FallaCode100Demo | null;
  /**
   * Si retener o no el código en claro para el panel de demo.
   * Default: `DEMO_MODE === "true"`. Los tests lo pasan explícito.
   */
  readonly retenerCodigoParaPanelDemo?: boolean;
}

function identificadorDeSesion(): string {
  // Formato análogo al `session_id` que devolvería Code100: identifica el acto
  // de firma, no contiene ningún dato de la persona ni de los documentos.
  return `MOCK-CODE100-${randomUUID().slice(0, 13).toUpperCase()}`;
}

function esperar(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolver) => {
    setTimeout(resolver, ms);
  });
}

/**
 * Los tres firmantes de cada documento, en el orden de la fila 37 de la matriz
 * de cumplimiento: *"Firmar en este orden: cliente primero; Interseguros y
 * Alianza después, en paralelo"*. El acto del cliente es el que dispara las dos
 * contrafirmas (P8, `DESPUÉS DE LA FIRMA DEL CLIENTE`, paso 2).
 */
const FIRMANTES = [
  "Cliente (firma electrónica no cualificada)",
  "Interseguros S.A. — Corredores de Seguros (cualificada)",
  "Alianza Garantía Seguros y Reaseguros S.A. (cualificada)",
] as const;

/**
 * El PDF **firmado** que devolvería `POST /signature/sign-pdf`.
 *
 * Code100 recibe el PDF cerrado y le incrusta las firmas; este mock no tiene
 * los bytes originales —el puerto le pasa el `PaqueteDocumental`, que es
 * metadata— así que genera una constancia de firma con los datos del acto. Lo
 * que sí es real y es lo que importa: **el archivo es determinista y su
 * SHA-256 es el que se registra como `hashSolicitudFirmada` /
 * `hashFipfFirmado`**, así que la huella que queda en el expediente es
 * verificable contra el archivo que después se descarga en P9.
 *
 * Usa el escritor de PDF de `src/documentos/pdf.ts` en vez de traer una
 * librería: es el mismo que ya emite los documentos del paquete, y garantiza
 * los mismos bytes ante el mismo contenido (sin `/ID` aleatorio ni fecha de
 * reloj).
 */
function renderizarPdfFirmado(
  documento: DocumentoCerrado,
  sesion: { readonly idCode100: string; readonly canal: CanalFirma },
  firmadoEn: string,
): Uint8Array {
  const pdf = crearDocumentoPdf({
    titulo: `${documento.codigo} — firmado`,
    autor: "Code100 (simulado)",
    // La fecha del acto, nunca el reloj: si dependiera del momento de
    // generación, el archivo no sería reproducible y su hash tampoco.
    creadoEn: firmadoEn,
  });

  const pagina = pdf.nuevaPagina();
  let y = 90;

  pagina.texto(56, y, "CONSTANCIA DE FIRMA ELECTRÓNICA", { tamano: 16, fuente: "negrita" });
  y += 26;
  pagina.texto(56, y, "Documento simulado — entorno de demostración", { tamano: 10 });
  y += 34;

  const filas: readonly (readonly [string, string])[] = [
    ["Documento", documento.codigo],
    ["Versión", `v${documento.version}`],
    ["Huella del documento cerrado", documento.hashSha256],
    ["Identificador Code100", sesion.idCode100],
    ["Canal del acto de firma", sesion.canal],
    ["Fecha y hora", firmadoEn],
  ];

  for (const [rotulo, valor] of filas) {
    pagina.texto(56, y, rotulo, { tamano: 9, fuente: "negrita" });
    y += 13;
    y += pagina.parrafo(56, y, 480, valor, { tamano: 10 });
    y += 8;
  }

  y += 10;
  pagina.texto(56, y, "FIRMANTES", { tamano: 11, fuente: "negrita" });
  y += 18;
  for (const firmante of FIRMANTES) {
    pagina.texto(56, y, `· ${firmante}`, { tamano: 10 });
    y += 15;
  }

  y += 16;
  pagina.parrafo(
    56,
    y,
    480,
    "La Solicitud y el FIPF se firmaron en un único acto: no existe una versión de este paquete " +
      "con un documento firmado y el otro no.",
    { tamano: 9 },
  );

  return pdf.construir();
}

/** El paquete tiene que llegar cerrado y hasheado (regla inviolable #4). */
function validarPaquete(paquete: PaqueteDocumental): void {
  const documentos = [paquete.solicitud, paquete.fipf];
  if (documentos.some((documento) => documento.hashSha256.trim() === "")) {
    throw new ErrorCode100(
      "PAQUETE_INVALIDO",
      "Code100 no acepta un documento sin huella digital: hay que cerrarlo y hashearlo antes de firmar.",
    );
  }
  if (paquete.solicitud.version !== paquete.fipf.version) {
    throw new ErrorCode100(
      "PAQUETE_INVALIDO",
      "La Solicitud y el FIPF tienen versiones distintas: se firman en un solo acto, con la misma versión.",
    );
  }
}

function proyectar(sesion: SesionFirmaMock, instante: string): ResultadoFirma {
  if (sesion.firma) return { estado: "FIRMADO", firma: sesion.firma };
  if (sesion.fallo) return { estado: "NO_FIRMADO", motivo: sesion.fallo.motivo, detalle: sesion.fallo.detalle };

  if (instante >= sesion.venceEn) {
    sesion.fallo = { motivo: "EXPIRADA", detalle: "El enlace de firma venció sin completarse." };
    sesion.actualizadoEn = instante;
    return { estado: "NO_FIRMADO", motivo: "EXPIRADA", detalle: sesion.fallo.detalle };
  }

  return {
    estado: "PENDIENTE",
    enlaceEnviadoEn: sesion.enlaceEnviadoEn,
    venceEn: sesion.venceEn,
    enlaceAbierto: sesion.otp !== null,
  };
}

export function crearSignatureProviderMock(
  opciones: OpcionesSignatureProviderMock = {},
): SignatureProvider {
  const ahora = opciones.ahora ?? (() => new Date());
  const demoraEnvioEnlaceMs = opciones.demoraEnvioEnlaceMs ?? DEMORA_ENVIO_ENLACE_MS;
  const vigenciaEnlaceMs = opciones.vigenciaEnlaceMs ?? VIGENCIA_ENLACE_FIRMA_MS;
  const fallaForzada = opciones.fallaForzada ?? (() => null);

  return {
    async iniciarFirma(input: IniciarFirmaInput): Promise<FirmaIniciada> {
      validarPaquete(input.paqueteDocumental);

      const falla = fallaForzada();
      if (falla === "TIMEOUT") {
        await esperar(demoraEnvioEnlaceMs);
        throw new ErrorCode100("TIMEOUT", "Code100 no respondió dentro del tiempo previsto (simulado).");
      }

      await esperar(demoraEnvioEnlaceMs);

      if (falla === "RECHAZADA") {
        throw new ErrorCode100("RECHAZADA", "Code100 rechazó la apertura del acto de firma (simulado).");
      }

      const enviado = ahora();
      const idCode100 = identificadorDeSesion();
      const sesion: SesionFirmaMock = {
        idCode100,
        expedienteId: input.expedienteId,
        canal: input.canal,
        destino: input.destino,
        // Los DOS documentos en la MISMA sesión: fila 36 de la matriz y regla
        // inviolable #3. No hay ninguna rama que abra una sesión por documento.
        paquete: input.paqueteDocumental,
        enlaceEnviadoEn: enviado.toISOString(),
        venceEn: new Date(enviado.getTime() + vigenciaEnlaceMs).toISOString(),
        urlActoDeFirma: `https://firmador.simulado.code100.com.py/sign/${idCode100}`,
        otp: null,
        firma: null,
        documentosFirmados: null,
        fallo: null,
        actualizadoEn: enviado.toISOString(),
      };

      sesiones.set(idCode100, sesion);

      return {
        idCode100,
        enlaceEnviadoEn: sesion.enlaceEnviadoEn,
        venceEn: sesion.venceEn,
        urlActoDeFirma: sesion.urlActoDeFirma,
      };
    },

    async descargarDocumentosFirmados(idCode100: string): Promise<DocumentosFirmados | null> {
      // Los dos o ninguno: `documentosFirmados` se escribe en la misma
      // asignación que la firma, así que no puede haber uno solo.
      return sesiones.get(idCode100)?.documentosFirmados ?? null;
    },

    async confirmarResultado(idCode100: string): Promise<ResultadoFirma> {
      const sesion = sesiones.get(idCode100);
      if (!sesion) {
        return {
          estado: "NO_FIRMADO",
          motivo: "ERROR_PROVEEDOR",
          detalle: `Code100 no conoce el acto de firma ${idCode100}.`,
        };
      }
      return proyectar(sesion, ahora().toISOString());
    },
  };
}

// ---------------------------------------------------------------------------
// Canal EXCLUSIVO del panel de demo y de los tests
// ---------------------------------------------------------------------------
//
// Nada de esto es parte de `SignatureProvider`: simula lo que hace la persona
// del otro lado del enlace, en la pantalla de Code100. Ningún Route Handler
// del flujo P0–P9 puede importar estas funciones — si el código del OTP sale
// por la API del flujo, se viola la regla inviolable #2.

export type ResultadoAperturaDemo =
  | { readonly ok: true; readonly expiraEn: string }
  | { readonly ok: false; readonly motivo: "NO_ENCONTRADA" | "YA_CERRADA" | "EXPIRADA" };

/**
 * La persona abre el enlace: Code100 emite el OTP de firma y lo pide en su
 * pantalla. El código en claro solo llega al registro del panel de demo.
 */
export function abrirEnlaceDeFirmaMock(
  idCode100: string,
  opciones: { readonly ahora?: () => Date; readonly retenerCodigoParaPanelDemo?: boolean } = {},
): ResultadoAperturaDemo {
  const ahora = opciones.ahora ?? (() => new Date());
  const retener = opciones.retenerCodigoParaPanelDemo ?? process.env.DEMO_MODE === "true";

  const sesion = sesiones.get(idCode100);
  if (!sesion) return { ok: false, motivo: "NO_ENCONTRADA" };
  if (sesion.firma || sesion.fallo) return { ok: false, motivo: "YA_CERRADA" };

  const instante = ahora();
  const emitidoEn = instante.toISOString();
  if (emitidoEn >= sesion.venceEn) {
    sesion.fallo = { motivo: "EXPIRADA", detalle: "El enlace de firma venció sin completarse." };
    sesion.actualizadoEn = emitidoEn;
    return { ok: false, motivo: "EXPIRADA" };
  }

  const codigo = generarCodigoOtp();
  const expiraEn = new Date(instante.getTime() + VIGENCIA_OTP_MS).toISOString();

  // Solo el HMAC queda en la sesión (regla inviolable #2).
  sesion.otp = { hash: hmacOtp(codigo), emitidoEn, expiraEn, intentos: 0 };
  sesion.actualizadoEn = emitidoEn;

  if (retener) {
    codigosDemo.set(idCode100, { idCode100, codigo, destino: sesion.destino, emitidoEn, expiraEn });
  }

  return { ok: true, expiraEn };
}

export type ResultadoFirmaDemo =
  | { readonly ok: true; readonly firma: Firma }
  | {
      readonly ok: false;
      readonly motivo:
        | "NO_ENCONTRADA"
        | "ENLACE_NO_ABIERTO"
        | "CODIGO_INCORRECTO"
        | "INTENTOS_AGOTADOS"
        | "OTP_EXPIRADO"
        | "ENLACE_EXPIRADO"
        | "YA_CERRADA"
        | "FALLA_DEL_PROVEEDOR";
      readonly intentosRestantes?: number;
    };

/**
 * La persona tipea el OTP en la pantalla de Code100 y firma. **Un solo acto
 * para los dos documentos** (regla inviolable #3).
 *
 * `fallarAMitadDelSellado` es la palanca que existe para poder demostrar —y
 * testear— la atomicidad: corta el sellado con la primera huella ya calculada
 * y la segunda no. Lo importante es lo que pasa entonces: como nada se escribió
 * todavía, la sesión queda sin firma y con los dos documentos sin firmar.
 */
export function firmarEnCode100Mock(
  idCode100: string,
  codigoIngresado: string,
  opciones: {
    readonly ahora?: () => Date;
    readonly fallarAMitadDelSellado?: boolean;
  } = {},
): ResultadoFirmaDemo {
  const ahora = opciones.ahora ?? (() => new Date());

  const sesion = sesiones.get(idCode100);
  if (!sesion) return { ok: false, motivo: "NO_ENCONTRADA" };
  if (sesion.firma || sesion.fallo) return { ok: false, motivo: "YA_CERRADA" };

  const firmadoEn = ahora().toISOString();
  if (firmadoEn >= sesion.venceEn) {
    sesion.fallo = { motivo: "EXPIRADA", detalle: "El enlace de firma venció sin completarse." };
    sesion.actualizadoEn = firmadoEn;
    return { ok: false, motivo: "ENLACE_EXPIRADO" };
  }

  const otp = sesion.otp;
  if (!otp) return { ok: false, motivo: "ENLACE_NO_ABIERTO" };
  if (firmadoEn >= otp.expiraEn) return { ok: false, motivo: "OTP_EXPIRADO" };
  if (otp.intentos >= INTENTOS_MAXIMOS_OTP) return { ok: false, motivo: "INTENTOS_AGOTADOS" };

  if (!coincideConHash(codigoIngresado, otp.hash)) {
    otp.intentos += 1;
    sesion.actualizadoEn = firmadoEn;
    const intentosRestantes = Math.max(0, INTENTOS_MAXIMOS_OTP - otp.intentos);
    return intentosRestantes === 0
      ? { ok: false, motivo: "INTENTOS_AGOTADOS" }
      : { ok: false, motivo: "CODIGO_INCORRECTO", intentosRestantes };
  }

  // --- Sellado atómico ---------------------------------------------------
  // Los dos PDF firmados se renderizan y hashean en listas temporales; recién
  // cuando están los dos se escriben `sesion.firma` y `sesion.documentosFirmados`,
  // en dos asignaciones seguidas sin nada en el medio que pueda fallar. Hasta
  // ese momento la sesión no cambió, así que una interrupción acá no deja
  // ningún documento firmado.
  const documentos = [sesion.paquete.solicitud, sesion.paquete.fipf] as const;
  const pdfs: Uint8Array[] = [];
  const huellas: string[] = [];
  for (const documento of documentos) {
    if (opciones.fallarAMitadDelSellado && huellas.length === 1) {
      sesion.actualizadoEn = firmadoEn;
      return { ok: false, motivo: "FALLA_DEL_PROVEEDOR" };
    }
    const bytes = renderizarPdfFirmado(documento, sesion, firmadoEn);
    pdfs.push(bytes);
    // La huella registrada es la del archivo que se va a poder descargar.
    huellas.push(createHash("sha256").update(bytes).digest("hex"));
  }

  const firma: Firma = {
    canal: sesion.canal,
    idCode100,
    firmadoEn,
    hashSolicitudFirmada: huellas[0],
    hashFipfFirmado: huellas[1],
  };

  sesion.firma = firma;
  sesion.documentosFirmados = { solicitud: pdfs[0], fipf: pdfs[1] };
  sesion.otp = null; // Uso único: el código no sirve para nada más.
  sesion.actualizadoEn = firmadoEn;
  codigosDemo.delete(idCode100);

  return { ok: true, firma };
}

/** La persona rechaza o cancela el acto de firma en la pantalla de Code100. */
export function cerrarSinFirmarMock(
  idCode100: string,
  motivo: MotivoNoFirmado = "RECHAZADA",
  detalle: string | null = null,
  ahora: () => Date = () => new Date(),
): boolean {
  const sesion = sesiones.get(idCode100);
  if (!sesion || sesion.firma || sesion.fallo) return false;
  sesion.fallo = { motivo, detalle };
  sesion.otp = null;
  sesion.actualizadoEn = ahora().toISOString();
  codigosDemo.delete(idCode100);
  return true;
}

/** Sesiones simuladas vivas en esta instancia, de la más nueva a la más vieja. */
export function listarSesionesFirmaMock(): readonly Readonly<SesionFirmaMock>[] {
  return [...sesiones.values()].sort((a, b) => (a.enlaceEnviadoEn < b.enlaceEnviadoEn ? 1 : -1));
}

export function obtenerSesionFirmaMock(idCode100: string): Readonly<SesionFirmaMock> | null {
  return sesiones.get(idCode100) ?? null;
}

/** Código en claro del OTP de firma. Solo el panel de demo puede leerlo. */
export function obtenerCodigoFirmaDemo(idCode100: string): CodigoFirmaDemo | null {
  return codigosDemo.get(idCode100) ?? null;
}

/** Solo para tests: deja el registro de sesiones simuladas en blanco. */
export function limpiarSesionesFirmaMock(): void {
  sesiones.clear();
  codigosDemo.clear();
}
