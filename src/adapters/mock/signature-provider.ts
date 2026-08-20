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
 *   - firmar ≈ `POST /signature/sign-pdf`: devuelve el PDF firmado.
 *   - `confirmarResultado` ≈ `POST /signature/getSessionId`: el estado.
 *
 * ## Regla inviolable #3 — ya no se defiende acá
 *
 * Este mock tenía una coreografía entera para la atomicidad: calcular las dos
 * huellas antes de escribir nada, asentarlas en una sola asignación, y una
 * palanca (`fallarAMitadDelSellado`) para poder demostrar que un corte a mitad
 * no dejaba un documento firmado y el otro no.
 *
 * Con el documento único (D-11) nada de eso hace falta: hay un PDF y una
 * huella. La regla dejó de depender de que el proveedor —o su simulación— se
 * porte bien, y pasó a ser una propiedad de la estructura. La palanca de demo
 * se reemplazó por la falla que sí sigue siendo posible y que sí tiene un
 * estado que mostrar: que las firmas institucionales no lleguen después de la
 * del cliente, y el expediente quede en `FIRMADO_CLIENTE` con el cobro
 * inhabilitado (D-13).
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
  FirmaIniciada,
  IniciarFirmaInput,
  MotivoNoFirmado,
  ResultadoFirma,
  SignatureProvider,
} from "../../ports/signature-provider";
import { ErrorCode100 } from "../../ports/signature-provider";
import { INTENTOS_MAXIMOS_OTP, VIGENCIA_OTP_MS } from "../../domain/reglas-otp";
import { generarCodigoOtp } from "../../repositories/otp-hash";
import type { CanalFirma, DocumentoCerrado, Firma } from "../../domain/tipos";
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
let obtenerPepperConfigurado: (() => Promise<string>) | null = null;

/**
 * Fija de dónde sale el pepper del OTP de firma simulada.
 *
 * Antes se acuñaba con `randomBytes` **por proceso**. Con cómputo serverless
 * eso significa uno por instancia: un código hasheado al abrir el enlace no se
 * podía verificar al firmar si la petición caía en otra instancia, y daba
 * `CODIGO_INCORRECTO` sin que la persona se hubiera equivocado. Tiene que ser
 * estable entre instancias, así que lo provee el composition root desde
 * Secrets Manager.
 *
 * Sin configurar cae al valor por proceso, que es correcto en `next dev` y en
 * los tests: un solo proceso.
 */
export function configurarPepperFirmaDemo(obtener: (() => Promise<string>) | null): void {
  obtenerPepperConfigurado = obtener;
}

const PEPPER_DEL_PROCESO = estadoCompartidoDemo("firma.pepper", () =>
  randomBytes(32).toString("hex"),
);

async function hmacOtp(codigo: string): Promise<string> {
  const base = obtenerPepperConfigurado ? await obtenerPepperConfigurado() : PEPPER_DEL_PROCESO;
  // El propósito entra en el mensaje para que este hash no sea el mismo que el
  // de los OTP de P1 y P4 aunque comparta el pepper (regla inviolable #1: los
  // tres OTP son independientes).
  return createHmac("sha256", base).update(`FIRMA_DEMO:${codigo}`, "utf8").digest("hex");
}

async function coincideConHash(codigoIngresado: string, hashPersistido: string): Promise<boolean> {
  const calculado = Buffer.from(await hmacOtp(codigoIngresado), "hex");
  const persistido = Buffer.from(hashPersistido, "hex");
  if (calculado.length !== persistido.length) return false;
  return timingSafeEqual(calculado, persistido);
}

/**
 * Delegado opcional para que el OTP de firma viaje por un canal real en vez
 * de quedarse en el registro del panel: hoy lo implementa WhatsApp-Modular
 * (`src/adapters/live/otp-provider.ts`, propósito `SIGNATURE_P7A`) cuando
 * `INTEGRATION_OTP=live`. La simulación de Code100 sigue siendo esta — lo
 * único que se terceriza es emitir y verificar el código, que en el flujo
 * real también es un tercero (Code100) quien lo hace.
 */
export interface OtpFirmaRemoto {
  /** Emite y envía el código al destino. Nunca devuelve el código. */
  solicitar(
    destinoE164: string,
  ): Promise<
    | { readonly ok: true; readonly otpId: string; readonly expiraEn: string }
    | { readonly ok: false; readonly detalle: string }
  >;
  verificar(
    otpId: string,
    codigo: string,
  ): Promise<
    | { readonly ok: true }
    | { readonly ok: false; readonly motivo: "CODIGO_INCORRECTO"; readonly intentosRestantes: number }
    | { readonly ok: false; readonly motivo: "OTP_EXPIRADO" | "INTENTOS_AGOTADOS" | "FALLA_DEL_PROVEEDOR" }
  >;
}

/**
 * OTP de firma vivo dentro de una sesión de Code100 simulada. `LOCAL` es el
 * camino histórico (HMAC en la sesión, código visible en el panel de demo);
 * `REMOTO` es el emitido por WhatsApp-Modular — de ese código acá solo existe
 * el identificador opaco, y el panel no tiene nada que mostrar: el código va
 * en el WhatsApp de la persona.
 */
type OtpDeFirma =
  | {
      readonly tipo: "LOCAL";
      readonly hash: string;
      readonly emitidoEn: string;
      readonly expiraEn: string;
      intentos: number;
    }
  | {
      readonly tipo: "REMOTO";
      readonly otpId: string;
      readonly emitidoEn: string;
      readonly expiraEn: string;
    };

export interface SesionFirmaMock {
  readonly idCode100: string;
  readonly expedienteId: string;
  readonly canal: CanalFirma;
  readonly destino: string;
  readonly documento: DocumentoCerrado;
  readonly enlaceEnviadoEn: string;
  readonly venceEn: string;
  readonly urlActoDeFirma: string;
  /** `null` hasta que la persona abre el enlace y Code100 emite el código. */
  otp: OtpDeFirma | null;
  firma: Firma | null;
  /** El PDF firmado. Se escribe en la misma asignación que `firma`. */
  documentoFirmado: Uint8Array | null;
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

/**
 * Dónde viven las sesiones de firma simulada.
 *
 * **No puede ser un `Map` en memoria.** Lo fue, y desplegado en Amplify rompía
 * P8 entero: el cómputo es serverless, cada petición puede caer en otra
 * instancia, y la sesión creada al enviar el enlace no existía siete segundos
 * después al abrir el firmador ("Code100 no conoce el acto de firma").
 *
 * `estado-compartido.ts` resuelve el problema de *un* proceso con varias
 * instancias del módulo; este resuelve el de varias instancias de cómputo, y
 * son problemas distintos. Quien arma el adaptador decide el almacén: en
 * `next dev` y en los tests, memoria; desplegado, DynamoDB con TTL.
 */
export interface AlmacenFirmaDemo {
  obtener<T>(coleccion: string, clave: string): Promise<T | null>;
  guardar(coleccion: string, clave: string, valor: unknown): Promise<void>;
  listar<T>(coleccion: string): Promise<readonly T[]>;
  borrar(coleccion: string, clave: string): Promise<void>;
}

const COLECCION_SESIONES = "firma.sesiones";
const COLECCION_CODIGOS = "firma.codigos-demo";

/** Almacén por defecto: memoria del proceso, anclada en `globalThis`. */
function almacenEnMemoriaDelProceso(): AlmacenFirmaDemo {
  const datos = estadoCompartidoDemo(
    "firma.almacen",
    () => new Map<string, Map<string, unknown>>(),
  );
  const coleccionDe = (nombre: string) => {
    const existente = datos.get(nombre);
    if (existente) return existente;
    const nueva = new Map<string, unknown>();
    datos.set(nombre, nueva);
    return nueva;
  };

  return {
    async obtener<T>(coleccion: string, clave: string) {
      return (coleccionDe(coleccion).get(clave) as T | undefined) ?? null;
    },
    async guardar(coleccion, clave, valor) {
      coleccionDe(coleccion).set(clave, valor);
    },
    async listar<T>(coleccion: string) {
      return [...coleccionDe(coleccion).values()] as T[];
    },
    async borrar(coleccion, clave) {
      coleccionDe(coleccion).delete(clave);
    },
  };
}

let almacenConfigurado: AlmacenFirmaDemo | null = null;

/**
 * Fija el almacén que usan las funciones de módulo de este archivo.
 *
 * Es un setter y no un parámetro porque `abrirEnlaceDeFirmaMock` y compañía se
 * llaman desde Route Handlers que no tienen por qué conocer la persistencia
 * del simulador. Lo llama el composition root (`adapters/registro.ts`), que es
 * el único que sabe si hay DynamoDB detrás.
 */
export function configurarAlmacenFirmaDemo(almacen: AlmacenFirmaDemo | null): void {
  almacenConfigurado = almacen;
}

function almacen(): AlmacenFirmaDemo {
  return almacenConfigurado ?? almacenEnMemoriaDelProceso();
}

async function leerSesion(idCode100: string): Promise<SesionFirmaMock | null> {
  return almacen().obtener<SesionFirmaMock>(COLECCION_SESIONES, idCode100);
}

async function guardarSesion(sesion: SesionFirmaMock): Promise<void> {
  await almacen().guardar(COLECCION_SESIONES, sesion.idCode100, sesion);
}

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
 * los bytes originales —el puerto le pasa el `DocumentoCerrado`, que es
 * metadata— así que genera una constancia de firma con los datos del acto. Lo
 * que sí es real y es lo que importa: **el archivo es determinista y su
 * SHA-256 es el que se registra como `hashDocumentoFirmado`**, así que la
 * huella que queda en el expediente es verificable contra el archivo que
 * después se descarga en P9.
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

/**
 * El documento tiene que llegar cerrado y hasheado (regla inviolable #4).
 *
 * La segunda comprobación que había acá —que la Solicitud y el FIPF vinieran
 * con la misma versión— desapareció con el documento único (D-11): son
 * secciones del mismo archivo y no hay dos versiones que puedan diferir.
 */
function validarDocumento(documento: DocumentoCerrado): void {
  if (documento.hashSha256.trim() === "") {
    throw new ErrorCode100(
      "PAQUETE_INVALIDO",
      "Code100 no acepta un documento sin huella digital: hay que cerrarlo y hashearlo antes de firmar.",
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
    // El mock alinea la caducidad de la sesión con `venceEn` porque es el
    // único dato que tiene. El proveedor real la informa por su cuenta
    // (`fecha_expiracion` / `expirado`) y puede no coincidir: la rama de
    // arriba ya la habría convertido en NO_FIRMADO, así que acá siempre es
    // `false` — el campo existe para que el adaptador oficial pueda decir otra
    // cosa sin cambiar el contrato (D-10).
    expirada: false,
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
      validarDocumento(input.documento);

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
        documento: input.documento,
        enlaceEnviadoEn: enviado.toISOString(),
        venceEn: new Date(enviado.getTime() + vigenciaEnlaceMs).toISOString(),
        urlActoDeFirma: `https://firmador.simulado.code100.com.py/sign/${idCode100}`,
        otp: null,
        firma: null,
        documentoFirmado: null,
        fallo: null,
        actualizadoEn: enviado.toISOString(),
      };

      await guardarSesion(sesion);

      return {
        idCode100,
        enlaceEnviadoEn: sesion.enlaceEnviadoEn,
        venceEn: sesion.venceEn,
        urlActoDeFirma: sesion.urlActoDeFirma,
      };
    },

    async descargarDocumentoFirmado(idCode100: string): Promise<Uint8Array | null> {
      return (await leerSesion(idCode100))?.documentoFirmado ?? null;
    },

    async confirmarResultado(idCode100: string): Promise<ResultadoFirma> {
      const sesion = await leerSesion(idCode100);
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
  | { readonly ok: false; readonly motivo: "NO_ENCONTRADA" | "YA_CERRADA" | "EXPIRADA" | "ERROR_ENVIO" };

/**
 * La persona abre el enlace: Code100 emite el OTP de firma y lo pide en su
 * pantalla. Con `otpRemoto` (WhatsApp-Modular) y canal WHATSAPP, el código
 * viaja de verdad por WhatsApp y acá solo queda su identificador; si no, se
 * emite localmente y el código en claro solo llega al registro del panel.
 */
export async function abrirEnlaceDeFirmaMock(
  idCode100: string,
  opciones: {
    readonly ahora?: () => Date;
    readonly retenerCodigoParaPanelDemo?: boolean;
    readonly otpRemoto?: OtpFirmaRemoto | null;
  } = {},
): Promise<ResultadoAperturaDemo> {
  const ahora = opciones.ahora ?? (() => new Date());
  const retener = opciones.retenerCodigoParaPanelDemo ?? process.env.DEMO_MODE === "true";

  const sesion = await leerSesion(idCode100);
  if (!sesion) return { ok: false, motivo: "NO_ENCONTRADA" };
  if (sesion.firma || sesion.fallo) return { ok: false, motivo: "YA_CERRADA" };

  const instante = ahora();
  const emitidoEn = instante.toISOString();
  if (emitidoEn >= sesion.venceEn) {
    sesion.fallo = { motivo: "EXPIRADA", detalle: "El enlace de firma venció sin completarse." };
    sesion.actualizadoEn = emitidoEn;
    await guardarSesion(sesion);
    return { ok: false, motivo: "EXPIRADA" };
  }

  // Camino remoto: WhatsApp-Modular emite el código con propósito
  // SIGNATURE_P7A (independiente del de P1, regla inviolable #1) y lo manda
  // al mismo destino del enlace. Solo aplica al canal WHATSAPP: para correo
  // no hay riel remoto y se sigue emitiendo local.
  if (opciones.otpRemoto && sesion.canal === "WHATSAPP") {
    const remoto = await opciones.otpRemoto.solicitar(sesion.destino);
    if (!remoto.ok) return { ok: false, motivo: "ERROR_ENVIO" };
    sesion.otp = { tipo: "REMOTO", otpId: remoto.otpId, emitidoEn, expiraEn: remoto.expiraEn };
    sesion.actualizadoEn = emitidoEn;
    await guardarSesion(sesion);
    // Nada para el panel: el código no existe en este proceso (viaja por
    // WhatsApp), que es exactamente el punto de usar el canal real.
    return { ok: true, expiraEn: remoto.expiraEn };
  }

  const codigo = generarCodigoOtp();
  const expiraEn = new Date(instante.getTime() + VIGENCIA_OTP_MS).toISOString();

  // Solo el HMAC queda en la sesión (regla inviolable #2).
  sesion.otp = { tipo: "LOCAL", hash: await hmacOtp(codigo), emitidoEn, expiraEn, intentos: 0 };
  sesion.actualizadoEn = emitidoEn;
  await guardarSesion(sesion);

  if (retener) {
    await almacen().guardar(COLECCION_CODIGOS, idCode100, {
      idCode100,
      codigo,
      destino: sesion.destino,
      emitidoEn,
      expiraEn,
    });
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
 * sobre un solo documento** (D-11).
 */
export async function firmarEnCode100Mock(
  idCode100: string,
  codigoIngresado: string,
  opciones: {
    readonly ahora?: () => Date;
    readonly otpRemoto?: OtpFirmaRemoto | null;
  } = {},
): Promise<ResultadoFirmaDemo> {
  const ahora = opciones.ahora ?? (() => new Date());

  const sesion = await leerSesion(idCode100);
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

  if (otp.tipo === "REMOTO") {
    // El código lo tiene WhatsApp-Modular: vigencia, uso único e intentos los
    // aplica él (misma política que la regla inviolable #1). Sin delegado no
    // hay forma legítima de verificar — jamás se aprueba por omisión.
    if (!opciones.otpRemoto) return { ok: false, motivo: "FALLA_DEL_PROVEEDOR" };
    const verificacion = await opciones.otpRemoto.verificar(otp.otpId, codigoIngresado);
    if (!verificacion.ok) {
      sesion.actualizadoEn = firmadoEn;
      if (verificacion.motivo === "CODIGO_INCORRECTO") {
        return verificacion.intentosRestantes === 0
          ? { ok: false, motivo: "INTENTOS_AGOTADOS" }
          : {
              ok: false,
              motivo: "CODIGO_INCORRECTO",
              intentosRestantes: verificacion.intentosRestantes,
            };
      }
      return { ok: false, motivo: verificacion.motivo };
    }
  } else {
    if (firmadoEn >= otp.expiraEn) return { ok: false, motivo: "OTP_EXPIRADO" };
    if (otp.intentos >= INTENTOS_MAXIMOS_OTP) return { ok: false, motivo: "INTENTOS_AGOTADOS" };

    if (!(await coincideConHash(codigoIngresado, otp.hash))) {
      otp.intentos += 1;
      sesion.actualizadoEn = firmadoEn;
      // El contador de intentos tiene que persistir, o cada reintento
      // empezaría de cero y los 3 intentos de la regla #1 no limitarían nada.
      await guardarSesion(sesion);
      const intentosRestantes = Math.max(0, INTENTOS_MAXIMOS_OTP - otp.intentos);
      return intentosRestantes === 0
        ? { ok: false, motivo: "INTENTOS_AGOTADOS" }
        : { ok: false, motivo: "CODIGO_INCORRECTO", intentosRestantes };
    }
  }

  // --- Sellado -----------------------------------------------------------
  // Con el documento único (D-11) esto dejó de ser un sellado atómico de dos
  // piezas: hay un PDF, se renderiza, se hashea y se escribe. La coreografía
  // que había acá —dos listas temporales y dos asignaciones seguidas sin nada
  // en el medio que pudiera fallar— existía para que una interrupción no
  // dejara un documento firmado y el otro no. Ese riesgo se fue con el
  // segundo archivo.
  const bytes = renderizarPdfFirmado(sesion.documento, sesion, firmadoEn);
  // La huella registrada es la del archivo que se va a poder descargar.
  const hashDocumentoFirmado = createHash("sha256").update(bytes).digest("hex");

  const firma: Firma = {
    canal: sesion.canal,
    idCode100,
    firmadoEn,
    hashDocumentoFirmado,
  };

  sesion.firma = firma;
  sesion.documentoFirmado = bytes;
  sesion.otp = null; // Uso único: el código no sirve para nada más.
  sesion.actualizadoEn = firmadoEn;
  await guardarSesion(sesion);
  await almacen().borrar(COLECCION_CODIGOS, idCode100);

  return { ok: true, firma };
}

/** La persona rechaza o cancela el acto de firma en la pantalla de Code100. */
export async function cerrarSinFirmarMock(
  idCode100: string,
  motivo: MotivoNoFirmado = "RECHAZADA",
  detalle: string | null = null,
  ahora: () => Date = () => new Date(),
): Promise<boolean> {
  const sesion = await leerSesion(idCode100);
  if (!sesion || sesion.firma || sesion.fallo) return false;
  sesion.fallo = { motivo, detalle };
  sesion.otp = null;
  sesion.actualizadoEn = ahora().toISOString();
  await guardarSesion(sesion);
  await almacen().borrar(COLECCION_CODIGOS, idCode100);
  return true;
}

/** Sesiones simuladas vivas en esta instancia, de la más nueva a la más vieja. */
export async function listarSesionesFirmaMock(): Promise<readonly Readonly<SesionFirmaMock>[]> {
  const todas = await almacen().listar<SesionFirmaMock>(COLECCION_SESIONES);
  return [...todas].sort((a, b) => (a.enlaceEnviadoEn < b.enlaceEnviadoEn ? 1 : -1));
}

export async function obtenerSesionFirmaMock(
  idCode100: string,
): Promise<Readonly<SesionFirmaMock> | null> {
  return leerSesion(idCode100);
}

/** Código en claro del OTP de firma. Solo el panel de demo puede leerlo. */
export async function obtenerCodigoFirmaDemo(idCode100: string): Promise<CodigoFirmaDemo | null> {
  return almacen().obtener<CodigoFirmaDemo>(COLECCION_CODIGOS, idCode100);
}

/** Solo para tests: deja el registro de sesiones simuladas en blanco. */
export async function limpiarSesionesFirmaMock(): Promise<void> {
  const almacenActual = almacen();
  for (const coleccion of [COLECCION_SESIONES, COLECCION_CODIGOS]) {
    const claves = await almacenActual.listar<{ idCode100?: string }>(coleccion);
    for (const item of claves) {
      if (item?.idCode100) await almacenActual.borrar(coleccion, item.idCode100);
    }
  }
}
