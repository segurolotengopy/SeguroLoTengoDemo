/**
 * OCR de la cédula sobre Amazon Textract (`DetectDocumentText`).
 *
 * **Por qué `DetectDocumentText` y no `AnalyzeID`:** `AnalyzeID` es la API que
 * "entiende" documentos de identidad y devuelve campos ya nombrados, pero
 * está entrenada sobre **documentos de EE.UU.** y no reconoce la cédula
 * paraguaya. El permiso ni siquiera está concedido en `infra/iam.tf`, para que
 * nadie la use por error creyendo que es la opción buena. Se usa OCR genérico
 * y el parseo lo hacemos nosotros.
 *
 * Como el módulo de Rekognition, esto **no es un `IdentityProvider`**: recibe
 * bytes y devuelve líneas de texto con su confianza. Lo específico de la
 * cédula paraguaya está aislado en `extraerCamposCedulaParaguaya`, que es la
 * única función que habría que reescribir para otro país o documento.
 */
import { DetectDocumentTextCommand } from "@aws-sdk/client-textract";
import type { DetectDocumentTextCommandOutput } from "@aws-sdk/client-textract";
import { CONFIANZA_MINIMA_OCR } from "../../domain/identidad-parametros";
import { leerMrzTd1, normalizarLineasTd1 } from "../../domain/mrz";
import type { DatosMrz } from "../../domain/mrz";

/** Lo mínimo que necesitamos de un cliente de Textract (ver nota en el de Rekognition). */
export interface ClienteTextract {
  send(comando: DetectDocumentTextCommand): Promise<DetectDocumentTextCommandOutput>;
}

/**
 * Dónde cayó la línea en la imagen, en la escala 0–1 de Textract.
 *
 * Se conserva porque **la cédula tiene dos columnas** y el orden de lectura
 * salta de una a la otra: leyendo por orden, al rótulo `APELLIDOS` le seguía
 * `FECHA DE VENCIMIENTO`, que está a la derecha. El valor de un rótulo es el
 * que cae **debajo y en su misma columna**, y eso solo se sabe con la caja.
 */
export interface CajaLinea {
  readonly izquierda: number;
  readonly arriba: number;
  readonly ancho: number;
  readonly alto: number;
}

export interface LineaReconocida {
  readonly texto: string;
  /** 0–100, tal como la devuelve Textract. */
  readonly confianza: number;
  /** `null` cuando el proveedor no la informa. */
  readonly caja: CajaLinea | null;
}

export interface ResultadoOcr {
  /** Todas las líneas, en el orden en que Textract las devolvió. */
  readonly lineas: readonly LineaReconocida[];
  /** Líneas que alcanzan `CONFIANZA_MINIMA_OCR`. Son las únicas utilizables. */
  readonly lineasConfiables: readonly LineaReconocida[];
  /** Menor confianza entre las líneas confiables; `null` si no hay ninguna. */
  readonly confianzaMinima: number | null;
}

/**
 * Lee el texto de una imagen y separa lo confiable de lo que no.
 *
 * El filtro por `CONFIANZA_MINIMA_OCR` (90) no es opcional: los campos que
 * salen de acá quedan **bloqueados y no editables** en P5, y la fecha de
 * nacimiento alimenta el corte de edad 18–64 (regla inviolable #8). Un dígito
 * mal leído no lo corrige nadie después — el camino es repetir la captura.
 */
export async function leerTextoDocumento(
  cliente: ClienteTextract,
  imagen: Uint8Array,
): Promise<ResultadoOcr> {
  const respuesta = await cliente.send(
    new DetectDocumentTextCommand({ Document: { Bytes: imagen } }),
  );

  const lineas: LineaReconocida[] = (respuesta.Blocks ?? [])
    .filter((bloque) => bloque.BlockType === "LINE")
    .map((bloque) => {
      const b = bloque.Geometry?.BoundingBox;
      return {
        texto: (bloque.Text ?? "").trim(),
        confianza: bloque.Confidence ?? 0,
        caja:
          b?.Left !== undefined && b.Top !== undefined
            ? {
                izquierda: b.Left,
                arriba: b.Top,
                ancho: b.Width ?? 0,
                alto: b.Height ?? 0,
              }
            : null,
      };
    })
    .filter((linea) => linea.texto !== "");

  const lineasConfiables = lineas.filter((linea) => linea.confianza >= CONFIANZA_MINIMA_OCR);

  return {
    lineas,
    lineasConfiables,
    confianzaMinima:
      lineasConfiables.length > 0
        ? Math.min(...lineasConfiables.map((linea) => linea.confianza))
        : null,
  };
}

// ---------------------------------------------------------------------------
// MRZ del dorso
// ---------------------------------------------------------------------------

export type ResultadoMrzDorso =
  | { readonly encontrado: true; readonly datos: DatosMrz }
  | { readonly encontrado: false; readonly motivo: "SIN_MRZ" | "MRZ_INVALIDO" };

/**
 * Busca y valida el MRZ TD1 entre las líneas leídas del dorso.
 *
 * **El MRZ se busca sobre las líneas crudas, no sobre las confiables.** Suena
 * al revés, pero es correcto: la fuente OCR-B del MRZ suele bajarle la
 * confianza a Textract, y descartar por confianza antes de intentar leerlo
 * tiraría MRZ perfectamente válidos. Acá no hace falta el umbral porque el
 * MRZ trae **su propia verificación**: si los cuatro dígitos verificadores
 * cierran, la lectura es correcta sin importar qué confianza declaró Textract.
 * Es una verificación más fuerte que un umbral estadístico.
 *
 * `SIN_MRZ` no es un error: el formato anterior de cédula no lo tiene. Quien
 * llama decide qué hacer con eso — hoy, seguir sin esa verificación extra.
 */
export function buscarMrzTd1(
  lineas: readonly LineaReconocida[],
  referencia: Date = new Date(),
): ResultadoMrzDorso {
  const textos = lineas.map((linea) => linea.texto.replace(/\s/g, "").toUpperCase());

  // Las tres líneas pueden venir sueltas y consecutivas, o pegadas en una.
  for (let i = 0; i < textos.length; i += 1) {
    const candidatos = [textos.slice(i, i + 3).join("\n"), textos[i]];

    for (const candidato of candidatos) {
      if (!normalizarLineasTd1(candidato)) continue;
      const leido = leerMrzTd1(candidato, referencia);
      if (leido.ok) return { encontrado: true, datos: leido.datos };
      // Tiene forma de MRZ pero los verificadores no cierran: eso sí es un
      // problema —OCR mal leído o dorso adulterado— y no hay que seguir
      // buscando como si no lo hubiéramos visto.
      return { encontrado: false, motivo: "MRZ_INVALIDO" };
    }
  }

  return { encontrado: false, motivo: "SIN_MRZ" };
}

// ---------------------------------------------------------------------------
// Campos de la cédula paraguaya
// ---------------------------------------------------------------------------

/**
 * Número de cédula tal como se imprime en el frente: de 1 a 3 dígitos,
 * opcionalmente agrupados de a tres con punto. Cubre desde `1` hasta
 * `9.999.999`.
 */
const PATRON_NUMERO_CEDULA = /\b(\d{1,3}(?:\.\d{3})+|\d{6,8})\b/;

/** Fecha impresa en el frente, en formato `DD/MM/AAAA` o `DD-MM-AAAA`. */
const PATRON_FECHA = /\b(\d{2})[/-](\d{2})[/-](\d{4})\b/;

export interface CamposCedulaParaguaya {
  readonly numeroCedula: string | null;
  /** ISO 8601 (AAAA-MM-DD). */
  readonly fechaNacimiento: string | null;
  readonly fechasEncontradas: readonly string[];
}

/**
 * Extrae los campos del frente de una cédula paraguaya desde las líneas del OCR.
 *
 * **Es deliberadamente conservador y parcial.** El frente no tiene un formato
 * publicado por el Departamento de Identificaciones, así que reconocer nombres
 * y apellidos por posición sería adivinar. Lo que sí se puede reconocer sin
 * ambigüedad —número de cédula y fechas— se reconoce; el resto tiene que salir
 * del MRZ del dorso, que sí es un formato normado (ICAO Doc 9303) y trae
 * dígitos verificadores.
 *
 * Ese reparto es intencional: **el dato que manda es el del MRZ**, y esto sirve
 * para cruzarlo. Si el frente y el dorso no coinciden, se repite la captura.
 *
 * Devuelve todas las fechas encontradas porque la cédula trae varias
 * (nacimiento, emisión, vencimiento) y sin el formato oficial no se puede
 * afirmar cuál es cuál por posición. La de nacimiento se resuelve cruzando
 * contra el MRZ — ver `elegirFechaNacimiento`.
 */
export function extraerCamposCedulaParaguaya(
  lineas: readonly LineaReconocida[],
): CamposCedulaParaguaya {
  let numeroCedula: string | null = null;
  const fechasEncontradas: string[] = [];

  for (const { texto } of lineas) {
    if (numeroCedula === null) {
      const encontrado = texto.match(PATRON_NUMERO_CEDULA);
      if (encontrado) numeroCedula = encontrado[1].replace(/\./g, "");
    }

    const fecha = texto.match(PATRON_FECHA);
    if (fecha) {
      const [, dd, mm, aaaa] = fecha;
      fechasEncontradas.push(`${aaaa}-${mm}-${dd}`);
    }
  }

  return { numeroCedula, fechaNacimiento: null, fechasEncontradas };
}

/**
 * Resuelve cuál de las fechas del frente es la de nacimiento, usando el MRZ
 * como árbitro.
 *
 * Sin MRZ devuelve `null` a propósito: **adivinar la fecha de nacimiento es
 * exactamente lo que la regla inviolable #8 prohíbe**. Antes que elegir "la
 * más antigua" y arriesgar un corte de edad mal hecho, no se devuelve nada y
 * el flujo pide repetir la captura o deriva a revisión manual.
 */
export function elegirFechaNacimiento(
  campos: CamposCedulaParaguaya,
  mrz: DatosMrz | null,
): string | null {
  if (!mrz) return null;
  return campos.fechasEncontradas.includes(mrz.fechaNacimiento) ? mrz.fechaNacimiento : null;
}
