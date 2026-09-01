/**
 * Constancia del acto de firma del cliente — la evidencia mostrada a la
 * persona que firmó.
 *
 * **Por qué existe.** La firma del cliente es una firma electrónica **no
 * cualificada generada por el propio portal** (D1, ratificada el 30-ago-2026):
 * no hay certificado de un prestador que alguien pueda abrir para ver quién
 * firmó y con qué. Lo que prueba esa firma es el registro de evidencia
 * (`firma-cliente.ts`), y ese registro vivía solo en la consola interna. Quien
 * firmó no tenía forma de ver lo que respalda su propia firma.
 *
 * **Qué muestra, y por qué esos campos.** La Res. SS.SG. 210/2025 art. 4 pide
 * tres cosas de una firma simple respaldada por OTP —identificación del
 * firmante, integridad del documento y trazabilidad de la operación— y su
 * art. 9 enumera lo que hay que conservar: metadatos, dirección IP, fecha y
 * hora y códigos de validación. La constancia se arma sobre esos dos
 * artículos, agrupando la evidencia por el requisito que satisface, porque una
 * lista plana de registros no le dice a nadie qué prueba cada uno.
 *
 * **Qué NO muestra.** Ningún dato de salud ni la condición PEP (regla
 * inviolable #7) y ningún código de OTP (regla inviolable #2): del OTP viaja
 * su identificador, que es lo que cita la evidencia, nunca el código. El
 * canal se muestra enmascarado, tal como quedó asentado.
 *
 * Es una proyección pura del Expediente y de sus registros de evidencia: no
 * lee repositorios, no formatea para pantalla y no decide nada. La firma
 * institucional se lista aparte porque es de otra naturaleza —cualificada, con
 * certificado— y confundirlas sería sugerir que el cliente firmó con un
 * certificado que no tiene.
 */
import { PASO_EVIDENCIA_ACTO_FIRMA_CLIENTE, PASO_EVIDENCIA_OTP_FIRMA_ENVIO } from "./firma-cliente";
import { PASO_EVIDENCIA_VERIFICACION_P5 } from "./verificacion-identidad";
import type { Expediente, RegistroEvidencia } from "./tipos";

/** Un hecho probatorio, con la fuente de la que se lee. */
export interface HechoDeLaConstancia {
  readonly etiqueta: string;
  readonly valor: string;
}

/** Un requisito del art. 4, con los hechos que lo satisfacen. */
export interface PilarDeLaConstancia {
  readonly requisito: "IDENTIFICACION" | "INTEGRIDAD" | "TRAZABILIDAD";
  readonly titulo: string;
  readonly explicacion: string;
  readonly hechos: readonly HechoDeLaConstancia[];
}

export interface FirmaInstitucionalDeLaConstancia {
  readonly rol: string;
  readonly nivel: string;
  readonly modalidad: string;
  readonly certificado: string;
  readonly aplicadaEn: string;
}

export interface ConstanciaFirma {
  readonly documento: {
    readonly codigo: string;
    readonly codigoSeccionFipf: string;
    readonly version: number;
    readonly hashSha256: string;
    readonly cerradoEn: string;
  };
  /**
   * Naturaleza de la firma del cliente, dicha sin adornos: es simple / no
   * cualificada y la generó el portal. Decirlo evita que la constancia se lea
   * como un certificado cualificado, que es justamente lo que no es.
   */
  readonly naturaleza: {
    readonly nivel: "SIMPLE_NO_CUALIFICADA";
    readonly emisor: "SEGUROLOTENGO";
    readonly norma: string;
  };
  readonly firmadoEn: string;
  readonly canal: string;
  readonly destinoEnmascarado: string | null;
  readonly pilares: readonly PilarDeLaConstancia[];
  readonly firmasInstitucionales: readonly FirmaInstitucionalDeLaConstancia[];
  /** Cuántos registros de evidencia respaldan el acto. */
  readonly registrosDeEvidencia: number;
}

const NORMA_FIRMA_SIMPLE = "Res. SS.SG. N.º 210/2025, arts. 4 y 9";

function ultimoExitoso(
  historial: readonly RegistroEvidencia[],
  paso: string,
): RegistroEvidencia | null {
  const candidatos = historial.filter((r) => r.paso === paso && r.resultado === "EXITOSO");
  return candidatos.length > 0 ? (candidatos[candidatos.length - 1] ?? null) : null;
}

/** Lee `clave=valor` del detalle serializado de un registro. */
function delDetalle(registro: RegistroEvidencia | null, clave: string): string | null {
  if (!registro?.detalle) return null;
  for (const parte of registro.detalle.split(" · ")) {
    const separador = parte.indexOf("=");
    if (separador > 0 && parte.slice(0, separador).trim() === clave) {
      return parte.slice(separador + 1).trim();
    }
  }
  return null;
}

function hecho(etiqueta: string, valor: string | null): readonly HechoDeLaConstancia[] {
  return valor ? [{ etiqueta, valor }] : [];
}

/**
 * Proyecta la constancia, o `null` si el expediente todavía no tiene firma del
 * cliente o no tiene paquete cerrado — sin esas dos cosas no hay nada que
 * constatar.
 *
 * Solo constata la firma **interna**: si el acto lo produjo un proveedor, la
 * evidencia que respalda es otra y la constancia mentiría al citar los
 * artículos de la firma simple.
 */
export function proyectarConstanciaFirma(
  expediente: Expediente,
  historial: readonly RegistroEvidencia[],
): ConstanciaFirma | null {
  const { firma, paqueteDocumental } = expediente;
  if (!firma || !paqueteDocumental) return null;
  if (firma.origen !== "INTERNA") return null;

  const acto = ultimoExitoso(historial, PASO_EVIDENCIA_ACTO_FIRMA_CLIENTE);
  const envioOtp = ultimoExitoso(historial, PASO_EVIDENCIA_OTP_FIRMA_ENVIO);
  const identidad = ultimoExitoso(historial, PASO_EVIDENCIA_VERIFICACION_P5);
  const destino = delDetalle(acto, "destino");

  const pilares: readonly PilarDeLaConstancia[] = [
    {
      requisito: "IDENTIFICACION",
      titulo: "Quién firmó",
      explicacion:
        "Tu identidad se verificó antes de firmar, y el código de un solo uso se envió al canal que ya habías verificado.",
      hechos: [
        ...hecho("Identidad verificada el", identidad?.fecha ?? null),
        ...hecho("Canal del código", destino ?? null),
        ...hecho("Código de validación (referencia)", firma.referenciaActo),
        ...hecho("Código enviado el", envioOtp?.fecha ?? null),
      ],
    },
    {
      requisito: "INTEGRIDAD",
      titulo: "Qué firmaste",
      explicacion:
        "El documento se cerró y se le calculó una huella SHA-256 antes de habilitar la firma. Cualquier cambio posterior da una huella distinta.",
      hechos: [
        {
          etiqueta: "Documento",
          valor: `${paqueteDocumental.codigo} v${paqueteDocumental.version}`,
        },
        {
          etiqueta: "Sección FIPF",
          valor: paqueteDocumental.codigoSeccionFipf,
        },
        { etiqueta: "Huella SHA-256", valor: paqueteDocumental.hashSha256 },
        { etiqueta: "Cerrado el", valor: paqueteDocumental.cerradoEn },
      ],
    },
    {
      requisito: "TRAZABILIDAD",
      titulo: "Desde dónde y cuándo",
      explicacion:
        "El acto quedó asentado con su fecha, su dirección IP y su dispositivo, en un registro que no se sobrescribe ni se borra.",
      hechos: [
        { etiqueta: "Firmado el", valor: firma.firmadoEn },
        ...hecho("Dirección IP", acto?.ip ?? null),
        ...hecho("Dispositivo", acto?.dispositivo ?? null),
        ...hecho("Sesión", acto?.sesionId ?? null),
        ...hecho("Versión del texto aceptado", acto?.versionTextoAceptado ?? null),
      ],
    },
  ];

  return {
    documento: {
      codigo: paqueteDocumental.codigo,
      codigoSeccionFipf: paqueteDocumental.codigoSeccionFipf,
      version: paqueteDocumental.version,
      hashSha256: paqueteDocumental.hashSha256,
      cerradoEn: paqueteDocumental.cerradoEn,
    },
    naturaleza: {
      nivel: "SIMPLE_NO_CUALIFICADA",
      emisor: "SEGUROLOTENGO",
      norma: NORMA_FIRMA_SIMPLE,
    },
    firmadoEn: firma.firmadoEn,
    canal: firma.canal,
    destinoEnmascarado: destino,
    pilares,
    firmasInstitucionales: expediente.firmasInstitucionales.map((f) => ({
      rol: f.rol,
      nivel: f.nivel,
      modalidad: f.modalidad,
      certificado: f.certificado,
      aplicadaEn: f.aplicadaEn,
    })),
    registrosDeEvidencia: historial.filter((r) => r.paso.startsWith("FIRMA_CLIENTE_")).length,
  };
}
