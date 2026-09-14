/**
 * Puerto del asistente conversacional («Terra», ítem 35 de
 * `docs/Tabla de Integraciones externas - Tabla.csv`).
 *
 * Es la única puerta entre este sitio y el servicio ChatbotRAG
 * (repo `segurolotengopy/ChatbotRAG`): un agente conversacional configurable
 * por JSON, con recuperación documental (RAG) sobre textos aprobados y
 * versionados, y compuertas de seguridad en código.
 *
 * LO QUE ESTE PUERTO NO RECIBE, POR DISEÑO (regla inviolable #7 y sección
 * «Asistente IA» de CLAUDE.md): el expediente, la cédula, las respuestas de
 * salud, la condición PEP, datos de tarjeta ni códigos de verificación. La
 * firma de `responder` no tiene dónde ponerlos, y el caso de uso
 * (`src/domain/asistente.ts`) filtra el texto libre ANTES de llegar acá. El
 * asistente no puede invocar Bancard, Code100 ni SEBAOT: no tiene puerto hacia
 * ellos.
 *
 * El `perfilId` es el producto elegido en el selector (`PRODUCTOS` de
 * `catalogo.ts`): el servicio resuelve con él qué corpus, qué alcance y qué
 * orientación aplican. Así el chat «depende enteramente de los parámetros de
 * cada seguro» sin que este repo conozca esos parámetros.
 */

export interface MensajeAsistente {
  /** Identificador opaco de la conversación (lo genera el navegador; sin cookie). */
  readonly conversacionId: string;
  /** Producto elegido; `null` = el perfil por defecto del agente. */
  readonly perfilId: string | null;
  /** Texto ya filtrado por el caso de uso. Nunca contiene datos sensibles. */
  readonly texto: string;
}

export interface RespaldoAsistente {
  readonly fuenteId: string;
  readonly titulo: string;
  readonly version: string;
}

export type RespuestaAsistente =
  | {
      readonly ok: true;
      readonly texto: string;
      /** Documentos aprobados de los que salió la respuesta (visibles para la persona). */
      readonly respaldo: readonly RespaldoAsistente[];
      /** Compuertas del servicio que actuaron (`niega_ia`, `sin_respaldo`, …). Sin texto. */
      readonly avisos: readonly string[];
      readonly derivacion: boolean;
    }
  | { readonly ok: false; readonly motivo: "NO_DISPONIBLE" | "LIMITE" | "PERFIL_DESCONOCIDO" | "ERROR" };

export interface PerfilAsistente {
  readonly id: string;
  readonly nombre: string;
  readonly bienvenida: string;
}

export interface DescripcionAsistente {
  readonly nombreAsistente: string;
  readonly perfilPorDefecto: string | null;
  readonly perfiles: readonly PerfilAsistente[];
  readonly bienvenida: string;
}

export interface AsistenteProvider {
  /** Nombre del adaptador para el rótulo de evidencia («mock» / «ChatbotRAG · real»). */
  readonly nombre: string;
  describir(): Promise<DescripcionAsistente | null>;
  responder(mensaje: MensajeAsistente): Promise<RespuestaAsistente>;
}
