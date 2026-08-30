/**
 * Traducción de HTTP a los datos que el dominio necesita, compartida por los
 * Route Handlers del flujo.
 *
 * Vive en una carpeta con guion bajo: App Router ignora `_http/` como ruta,
 * así que nada de esto queda expuesto como endpoint.
 *
 * Acá se resuelven las tres cosas que la evidencia exige y que solo la capa
 * HTTP conoce (regla inviolable #10): IP, dispositivo y sesión. La sesión y
 * el expediente viajan en cookies `httpOnly` — el cliente nunca manda un
 * `expedienteId` en el cuerpo, así no puede operar sobre el expediente de
 * otra persona simplemente escribiendo otro id.
 */
import { randomUUID } from "node:crypto";
import { URL_BASE_VERIFICACION_POR_DEFECTO } from "@/domain/documentos";
import type { ContextoPeticion } from "@/domain/verificacion-canal-whatsapp";

export const COOKIE_SESION = "slt_sesion";
export const COOKIE_EXPEDIENTE = "slt_expediente";
export const COOKIE_OTP = "slt_otp";

/** Ruta pública de la verificación de documentos (CMP-06). */
export const RUTA_VERIFICACION = "/verificar";

/** 8 horas: cubre de sobra una sesión de contratación sin quedar viva para siempre. */
const VIDA_COOKIE_SEGUNDOS = 8 * 60 * 60;

export function leerCookies(request: Request): Readonly<Record<string, string>> {
  const cabecera = request.headers.get("cookie");
  if (!cabecera) return {};

  const pares: Record<string, string> = {};
  for (const trozo of cabecera.split(";")) {
    const separador = trozo.indexOf("=");
    if (separador === -1) continue;
    const nombre = trozo.slice(0, separador).trim();
    const valor = trozo.slice(separador + 1).trim();
    if (nombre) pares[nombre] = decodeURIComponent(valor);
  }
  return pares;
}

/**
 * IP del proponente. Detrás de Amplify Hosting / Cloudflare el valor
 * confiable es el primer elemento de `x-forwarded-for`. Es un dato que el
 * cliente puede falsificar si la app quedara expuesta sin proxy delante: no
 * se usa para autorizar nada, solo se registra como evidencia del intento,
 * que es exactamente lo que pide la regla #10.
 */
function resolverIp(request: Request): string {
  const reenviada = request.headers.get("x-forwarded-for");
  if (reenviada) {
    const primera = reenviada.split(",")[0]?.trim();
    if (primera) return primera;
  }
  return request.headers.get("x-real-ip")?.trim() || "desconocida";
}

function resolverDispositivo(request: Request): string {
  const agente = request.headers.get("user-agent")?.trim();
  if (!agente) return "desconocido";
  // Acotado: el user-agent es texto libre del cliente y termina en la base.
  return agente.slice(0, 256);
}

export interface ContextoHttp {
  readonly contexto: ContextoPeticion;
  readonly expedienteId: string | null;
  readonly otpId: string | null;
}

export function resolverContextoHttp(request: Request): ContextoHttp {
  const cookies = leerCookies(request);
  return {
    contexto: {
      ip: resolverIp(request),
      dispositivo: resolverDispositivo(request),
      sesionId: cookies[COOKIE_SESION] ?? randomUUID(),
    },
    expedienteId: cookies[COOKIE_EXPEDIENTE] ?? null,
    otpId: cookies[COOKIE_OTP] ?? null,
  };
}

function serializarCookie(nombre: string, valor: string, maxAge: number): string {
  const atributos = [
    `${nombre}=${encodeURIComponent(valor)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ];
  // `Secure` solo fuera de desarrollo: en http://localhost el navegador
  // descarta las cookies marcadas como Secure.
  if (process.env.NODE_ENV === "production") atributos.push("Secure");
  return atributos.join("; ");
}

export interface CookieAEscribir {
  readonly nombre: string;
  readonly valor: string;
  /** `0` borra la cookie. */
  readonly maxAge?: number;
}

/**
 * Respuesta JSON del flujo. Es el único constructor de respuestas que usan
 * los handlers de P1: centraliza `Cache-Control: no-store` para que ninguna
 * respuesta con datos del expediente quede cacheada en un intermediario.
 */
export function respuestaJson(
  cuerpo: unknown,
  opciones: { status?: number; cookies?: readonly CookieAEscribir[]; cabeceras?: Readonly<Record<string, string>> } = {},
): Response {
  const cabeceras = new Headers({
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...opciones.cabeceras,
  });

  for (const cookie of opciones.cookies ?? []) {
    cabeceras.append(
      "set-cookie",
      serializarCookie(cookie.nombre, cookie.valor, cookie.maxAge ?? VIDA_COOKIE_SEGUNDOS),
    );
  }

  return new Response(JSON.stringify(cuerpo), { status: opciones.status ?? 200, headers: cabeceras });
}

/**
 * Redirección con cookies, para los formularios que no llevan JavaScript.
 *
 * Existe por el botón *Finalizar* de las pantallas de cierre: para que el
 * navegador olvide el trámite terminado hay que borrarle la cookie, y borrar
 * una cookie es escribir una cabecera —cosa que un `page.tsx` no puede hacer en
 * Next 15, solo un Route Handler o una Server Action—. Con esto el botón es un
 * `<form method="post">` común y la pantalla sigue sin bundle de cliente.
 *
 * `303` y no `302` a propósito: es el código que convierte el POST del
 * formulario en un GET al destino. Con 302 hay navegadores que reenvían el POST
 * y la persona termina en un método que la pantalla de destino no atiende.
 */
export function respuestaRedireccion(
  destino: string,
  opciones: { cookies?: readonly CookieAEscribir[] } = {},
): Response {
  const cabeceras = new Headers({ location: destino, "cache-control": "no-store" });

  for (const cookie of opciones.cookies ?? []) {
    cabeceras.append(
      "set-cookie",
      serializarCookie(cookie.nombre, cookie.valor, cookie.maxAge ?? VIDA_COOKIE_SEGUNDOS),
    );
  }

  return new Response(null, { status: 303, headers: cabeceras });
}

/** Cuerpo JSON del request, o `null` si no es JSON válido. */
export async function leerJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const cuerpo: unknown = await request.json();
    if (typeof cuerpo !== "object" || cuerpo === null) return null;
    return cuerpo as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Base del enlace que codifica el QR de verificación impreso en cada PDF.
 *
 * Se arma con el origen de la propia petición, igual que la URL de retorno de
 * Bancard: en el demo corre en `localhost` y en Amplify en el dominio
 * desplegado, sin necesidad de una variable de entorno más. La constante de
 * `src/domain/documentos.ts` queda como último recurso, para el día en que
 * esto se llame desde algo que no sea una petición HTTP.
 *
 * Consecuencia querida: el QR de un documento apunta al origen desde el que se
 * lo cerró, y no cambia después. El documento es inmutable (regla inviolable
 * #4) y su QR es parte de sus bytes: reescribirlo exigiría versión y huella
 * nuevas.
 */
export function urlBaseVerificacion(request: Request): string {
  try {
    return new URL(RUTA_VERIFICACION, new URL(request.url).origin).toString();
  } catch {
    return URL_BASE_VERIFICACION_POR_DEFECTO;
  }
}
