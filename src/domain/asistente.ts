/**
 * Caso de uso del asistente conversacional (Terra).
 *
 * Es deliberadamente CORTO y deliberadamente AISLADO: no recibe el expediente,
 * no conoce `transicionarExpediente`, no escribe evidencia y no toca ningún
 * puerto transaccional. Su trabajo es uno solo: dejar pasar hacia el servicio
 * de IA únicamente texto que no contenga datos sensibles, con el producto
 * elegido como perfil.
 *
 * DEFENSA EN PROFUNDIDAD. El servicio ChatbotRAG tiene sus propias compuertas
 * de entrada (bloquea cédula, tarjeta, salud, PEP, códigos); este filtro se
 * repite ACÁ porque la regla inviolable #7 es de este repositorio, no del
 * proveedor: «las respuestas médicas y la condición PEP no salen hacia
 * servicios de IA». Si el servicio cambiara de manos o de versión, esta
 * frontera sigue en pie. Los patrones son amplios a propósito: un falso
 * positivo cuesta una frase de cortesía; un falso negativo, una fuga.
 *
 * Cuando se bloquea, el texto NO viaja a ningún lado (ni a la bitácora): se
 * responde con un mensaje fijo y solo se registra la categoría.
 */
import { PRODUCTOS } from "./catalogo";
import type { AsistenteProvider, RespaldoAsistente } from "../ports/asistente-provider";

export const MAX_CARACTERES_ASISTENTE = 1500;
// eslint-disable-next-line no-control-regex -- la intención es justamente quitar controles
const CONTROLES = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/g;
export const ID_CONVERSACION_ASISTENTE = /^[A-Za-z0-9][A-Za-z0-9_-]{7,119}$/;

export type CategoriaBloqueada = "cedula" | "tarjeta" | "salud" | "pep" | "codigo";

/** Mensaje fijo cuando la persona ofrece un dato que este canal no recibe. */
export const TEXTO_ENTRADA_BLOQUEADA =
  "Por tu seguridad, por este chat no recibimos cédula, datos de salud, condición PEP, tarjetas ni " +
  "códigos de verificación: esos datos se completan solo dentro del proceso seguro del sitio. Contame tu " +
  "consulta sin esos datos y te ayudo.";

export const TEXTO_ASISTENTE_NO_DISPONIBLE =
  "El asistente no está disponible en este momento. Podés escribir a segurolotengo@interseguros360.com.";

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const VOCABULARIO: Readonly<Record<Exclude<CategoriaBloqueada, "cedula" | "tarjeta">, RegExp>> = {
  salud:
    /\b(enfermedad|enfermo|enferma|diagnostic|cancer|tumor|quimio|diabet|hipertens|cardiac|infarto|vih|sida|hepatitis|epilep|asma|depresion|ansiedad|psiquiatr|embaraz|cirugia|operaci|medicamento|receta|antecedente|preexist|discapacidad|internad|hospitaliz|sintoma|salud mental|adiccion|fumo\b|fumador|tabaco)\w*/,
  pep: /\b(pep\b|persona expuesta|politicamente expuest|funcionario publico|cargo publico|diputad|senador|ministr|alcalde|gobernador|candidat|partido politico)\w*/,
  codigo: /\b(otp|codigo de verificacion|codigo que me llego|codigo sms|codigo de whatsapp)\b|\bcodigo\b.*(?<!\d)\d{6}(?!\d)/,
};

/** «¿Cubre cáncer?» es pregunta de producto; «tengo cáncer» es dato personal. */
function esPreguntaGeneral(n: string): boolean {
  const primeraPersona =
    /\b(tengo|tuve|padezco|sufro|me diagnosticaron|me operaron|estoy (enfermo|enferma|embarazada|internado|internada|en tratamiento)|mi (mama|madre|papa|padre|esposo|esposa|hijo|hija|hermano|hermana|pareja) (tiene|tuvo|padece|sufre|esta)|soy (pep|funcionario|funcionaria|diputado|diputada|senador|senadora|ministro|ministra|candidato|candidata|diabetico|diabetica|hipertenso|hipertensa|fumador|fumadora)|\bfumo\b|tomo (medicamentos|pastillas|remedios))/;
  if (primeraPersona.test(n)) return false;
  return /\b(cubre|cobertura|incluye|excluye|exclusion|carencia|que pasa si|en caso de|se considera|aplica|paga|indemniza|que es|significa|requisitos?)\b/.test(n) || n.includes("?");
}

function pareceCedula(texto: string, n: string): boolean {
  const conPuntos = texto.match(/(?<![\d.])\d{1,3}(?:\.\d{3}){1,2}(?!\d|\.\d)/g) ?? [];
  const corridos = texto.match(/(?<![\d.])\d{6,8}(?!\d|\.\d)/g) ?? [];
  if (conPuntos.length === 0 && corridos.length === 0) return false;
  if (/\b(cedula|c\.?i\.?\b|documento|dni|carnet|pasaporte)/.test(n)) return true;
  const hayDinero = /\b(gs|usd|precio|premio|prima|cuota|costo|monto|cuesta|cuestan|vale|pagar|pago|anual|mensual|guaranies|dolares|importe|total)\b|\$/.test(n);
  return conPuntos.length > 0 && !hayDinero;
}

function pareceTarjeta(texto: string, n: string): boolean {
  if (/\b(tarjeta|cvv|cvc|codigo de seguridad|mastercard|visa)\b/.test(n)) return true;
  const secuencias = texto.match(/(?:\d[ -]?){13,19}/g) ?? [];
  return secuencias.some((s) => {
    const d = s.replace(/\D/g, "");
    if (d.length < 13 || d.length > 19) return false;
    let suma = 0;
    let doble = false;
    for (let i = d.length - 1; i >= 0; i--) {
      let x = Number(d[i]);
      if (doble) {
        x *= 2;
        if (x > 9) x -= 9;
      }
      suma += x;
      doble = !doble;
    }
    return suma % 10 === 0;
  });
}

/** Categorías sensibles presentes en el texto. Vacío = puede viajar al asistente. */
export function categoriasBloqueadas(texto: string): readonly CategoriaBloqueada[] {
  const n = normalizar(texto);
  const salida: CategoriaBloqueada[] = [];
  if (pareceCedula(texto, n)) salida.push("cedula");
  if (pareceTarjeta(texto, n)) salida.push("tarjeta");
  if (VOCABULARIO.salud.test(n) && !esPreguntaGeneral(n)) salida.push("salud");
  if (VOCABULARIO.pep.test(n) && !esPreguntaGeneral(n)) salida.push("pep");
  if (VOCABULARIO.codigo.test(n)) salida.push("codigo");
  return salida;
}

export function esPerfilConocido(valor: unknown): valor is string {
  return typeof valor === "string" && PRODUCTOS.some((p) => p.id === valor);
}

export interface EntradaAsistente {
  readonly conversacionId: unknown;
  readonly perfilId: unknown;
  readonly texto: unknown;
}

export type ResultadoAsistente =
  | { readonly ok: true; readonly bloqueado?: false; readonly texto: string; readonly respaldo: readonly RespaldoAsistente[]; readonly avisos: readonly string[]; readonly derivacion: boolean }
  | { readonly ok: false; readonly motivo: "CONVERSACION_INVALIDA" | "TEXTO_VACIO" | "TEXTO_LARGO" | "PERFIL_DESCONOCIDO" | "NO_DISPONIBLE" | "LIMITE" | "ERROR" }
  | { readonly ok: true; readonly bloqueado: true; readonly categorias: readonly CategoriaBloqueada[]; readonly texto: string };

export interface DependenciasAsistente {
  readonly asistente: AsistenteProvider;
}

export async function conversarConAsistente(deps: DependenciasAsistente, entrada: EntradaAsistente): Promise<ResultadoAsistente> {
  if (typeof entrada.conversacionId !== "string" || !ID_CONVERSACION_ASISTENTE.test(entrada.conversacionId)) {
    return { ok: false, motivo: "CONVERSACION_INVALIDA" };
  }
  const texto = typeof entrada.texto === "string" ? entrada.texto.replace(CONTROLES, "").trim() : "";
  if (texto.length === 0) return { ok: false, motivo: "TEXTO_VACIO" };
  if (texto.length > MAX_CARACTERES_ASISTENTE) return { ok: false, motivo: "TEXTO_LARGO" };

  let perfilId: string | null = null;
  if (entrada.perfilId !== null && entrada.perfilId !== undefined && entrada.perfilId !== "") {
    if (!esPerfilConocido(entrada.perfilId)) return { ok: false, motivo: "PERFIL_DESCONOCIDO" };
    perfilId = entrada.perfilId;
  }

  const categorias = categoriasBloqueadas(texto);
  if (categorias.length > 0) {
    return { ok: true, bloqueado: true, categorias, texto: TEXTO_ENTRADA_BLOQUEADA };
  }

  const respuesta = await deps.asistente.responder({ conversacionId: entrada.conversacionId, perfilId, texto });
  if (!respuesta.ok) return { ok: false, motivo: respuesta.motivo };
  return { ok: true, texto: respuesta.texto, respaldo: respuesta.respaldo, avisos: respuesta.avisos, derivacion: respuesta.derivacion };
}
