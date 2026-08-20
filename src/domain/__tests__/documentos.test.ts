/**
 * Tests del contenido del paquete documental y de la transición que lo
 * asienta.
 *
 * Lo que se prueba con más insistencia son las reglas que tienen consecuencia
 * legal, no la maquetación:
 *
 * - **Un correlativo, dos prefijos** (fila 47 de `docs/Tabla Cumplimiento
 *   SeguroLo Tengo - Tabla.csv`, Res. SS SG. 215/15, punto 14): los códigos
 *   se derivan del mismo número y la transición rechaza cualquier paquete
 *   cuyos códigos no lo hagan.
 * - **Regla inviolable #4**: no hay paquete sin huella digital, ni con
 *   versiones distintas entre los dos documentos.
 * - **Regla inviolable #8**: la edad impresa sale de la fecha de nacimiento de
 *   la cédula, no de un campo declarado.
 * - **Regla inviolable #7**: los canales van enmascarados; el QR no lleva
 *   ningún dato de la persona.
 */
import { describe, expect, it } from "vitest";
import {
  PREFIJO_FIPF,
  PREFIJO_SOLICITUD,
  VERSION_INICIAL_PAQUETE,
  armarContenidoPaquete,
  codigoFipf,
  codigoSolicitud,
  correlativoDeCodigo,
  formatearFecha,
  origenDeFondos,
  urlDeVerificacion,
} from "../documentos";
import { registrarPaqueteDocumental, transicionarExpediente } from "../expediente";
import type { Expediente, PaqueteDocumental } from "../tipos";
import {
  NUMERO_PROPUESTA_FIJO,
  REFERENCIA_BANCARD_FIJA,
  crearExpediente,
  expedienteEnDeclaracionesOk,
  expedienteEnPaqueteGenerado,
  identidadFixture,
} from "./fixtures";

const CERRADO_EN = "2026-08-09T15:05:00.000Z";

function paqueteValido(correlativo = NUMERO_PROPUESTA_FIJO): PaqueteDocumental {
  return {
    solicitud: {
      codigo: codigoSolicitud(correlativo),
      version: VERSION_INICIAL_PAQUETE,
      hashSha256: "a".repeat(64),
      cerradoEn: CERRADO_EN,
    },
    fipf: {
      codigo: codigoFipf(correlativo),
      version: VERSION_INICIAL_PAQUETE,
      hashSha256: "b".repeat(64),
      cerradoEn: CERRADO_EN,
    },
  };
}

// ---------------------------------------------------------------------------
// Códigos
// ---------------------------------------------------------------------------

describe("códigos del paquete", () => {
  it("usa el mismo correlativo con prefijos distintos", () => {
    expect(codigoSolicitud("00018425")).toBe("PROP-00018425");
    expect(codigoFipf("00018425")).toBe("FIPF-00018425");
    expect(PREFIJO_SOLICITUD).not.toBe(PREFIJO_FIPF);
  });

  it("recupera el correlativo desde cualquiera de los dos códigos", () => {
    expect(correlativoDeCodigo("PROP-00018425")).toBe("00018425");
    expect(correlativoDeCodigo("FIPF-00018425")).toBe("00018425");
    expect(correlativoDeCodigo("CASO-2026-000042")).toBeNull();
  });

  it("el QR de verificación lleva la URL con el código y nada más", () => {
    const url = urlDeVerificacion("PROP-00018425");
    expect(url).toBe("https://segurolotengo.com/verificar/PROP-00018425");
    // Ningún dato de la persona ni huella digital viajan en el QR.
    expect(url).not.toContain(identidadFixture.numeroCedula);
    expect(url).not.toMatch(/[a-f0-9]{64}/);
  });

  it("respeta una base de verificación propia, con o sin barra final", () => {
    expect(urlDeVerificacion("FIPF-1", "https://demo.local/v/")).toBe("https://demo.local/v/FIPF-1");
    expect(urlDeVerificacion("FIPF-1", "https://demo.local/v")).toBe("https://demo.local/v/FIPF-1");
  });
});

// ---------------------------------------------------------------------------
// Contenido
// ---------------------------------------------------------------------------

describe("armarContenidoPaquete", () => {
  const resultado = armarContenidoPaquete(expedienteEnPaqueteGenerado(), { cerradoEn: CERRADO_EN });
  if (!resultado.ok) throw new Error(`El fixture debería alcanzar: ${resultado.faltantes.join(",")}`);
  const { contenido } = resultado;

  it("arma los dos documentos con el mismo correlativo y se referencian entre sí", () => {
    expect(contenido.correlativo).toBe(NUMERO_PROPUESTA_FIJO);
    expect(contenido.solicitud.encabezado.codigo).toBe("PROP-00018425");
    expect(contenido.fipf.encabezado.codigo).toBe("FIPF-00018425");
    expect(contenido.solicitud.encabezado.codigoVinculado).toBe(contenido.fipf.encabezado.codigo);
    expect(contenido.fipf.encabezado.codigoVinculado).toBe(contenido.solicitud.encabezado.codigo);
    expect(contenido.solicitud.encabezado.version).toBe(contenido.fipf.encabezado.version);
  });

  it("la Solicitud lleva plan, coberturas, premio, beneficiario y declaraciones médicas", () => {
    // Los tres planes, con exactamente uno marcado como elegido.
    expect(contenido.solicitud.planes).toHaveLength(3);
    expect(contenido.solicitud.planes.filter((plan) => plan.elegido)).toHaveLength(1);
    const elegido = contenido.solicitud.planes.find((plan) => plan.elegido);
    expect(elegido?.nombre).toBe("CONFÍO+");
    expect(elegido?.premioAnual).toBe("Gs. 475.000");
    expect(elegido?.coberturas).toHaveLength(5);

    expect(contenido.solicitud.beneficiario[0].valor).toBe("Herederos legales — 100%");

    // Las tres médicas de P6, en orden y con la respuesta del expediente.
    expect(contenido.solicitud.declaracionesMedicas.map((d) => d.numero)).toEqual([1, 2, 3]);
    expect(contenido.solicitud.declaracionesMedicas[0].respuesta).toBe("SI");
    expect(contenido.solicitud.declaracionesMedicas[1].respuesta).toBe("NO");

    // Referencias de la operación: correlativo y premio. **No hay referencia
    // de Bancard ni medio de pago** (D-08): el documento se cierra antes de
    // que exista ninguna operación de cobro, y citar una sería inventarla.
    const referencias = contenido.solicitud.referencias.map((campo) => campo.valor);
    expect(referencias).toContain(NUMERO_PROPUESTA_FIJO);
    expect(referencias).toContain("Gs. 475.000");
    expect(JSON.stringify(contenido)).not.toContain(REFERENCIA_BANCARD_FIJA);
    expect(referencias).not.toContain("QR Bancard");
  });

  it("el FIPF lleva datos personales, laborales, económicos, identificación, PEP, origen de fondos y evidencias", () => {
    const etiquetas = (campos: readonly { etiqueta: string }[]): string[] =>
      campos.map((campo) => campo.etiqueta);

    expect(etiquetas(contenido.fipf.personales)).toEqual(
      expect.arrayContaining(["Nombres", "Apellidos", "Cédula", "Fecha de nacimiento", "Documento"]),
    );
    expect(etiquetas(contenido.fipf.laborales)).toEqual(
      expect.arrayContaining([
        "Situación laboral",
        "Actividad",
        "Profesión",
        "Ingreso mensual declarado",
        "Origen de fondos",
        "Propósito",
      ]),
    );
    // D-08 · los datos de la factura se capturan al pagar, que ahora ocurre
    // después de firmar: no pueden estar en el FIPF firmado.
    expect(etiquetas(contenido.fipf.laborales)).not.toContain("Identificación fiscal");
    expect(etiquetas(contenido.fipf.laborales)).not.toContain("Nombre a facturar");

    expect(contenido.fipf.pep.numero).toBe(8);
    expect(contenido.fipf.pep.respuesta).toBe("NO");
    expect(contenido.fipf.evidencias.length).toBeGreaterThanOrEqual(5);
    expect(contenido.fipf.declaraciones).toHaveLength(5);
  });

  it("la condición PEP va en el FIPF y no en la Solicitud", () => {
    expect(contenido.solicitud.declaracionesMedicas.some((d) => d.numero === 8)).toBe(false);
    const textoSolicitud = JSON.stringify(contenido.solicitud);
    expect(textoSolicitud.toLowerCase()).not.toContain("expuesta políticamente");
  });

  it("enmascara los canales verificados en los dos documentos", () => {
    const todo = JSON.stringify(contenido);
    expect(todo).not.toContain("+595981000456");
    expect(todo).not.toContain("monica.gorena@example.com");
    expect(todo).toContain("+595 ••• ••• 456");
    expect(todo).toContain("m••••••@example.com");
  });

  it("calcula la edad contra la fecha de nacimiento de la cédula (regla #8)", () => {
    // Nacida el 17/04/1990, documento cerrado el 09/08/2026 → 36 años.
    const edad = contenido.solicitud.proponente.find((campo) => campo.etiqueta === "Edad");
    expect(edad?.valor).toBe("36 años");

    const fecha = contenido.solicitud.proponente.find((campo) => campo.etiqueta === "Fecha de nacimiento");
    expect(fecha?.valor).toBe("17/04/1990");
  });

  it("informa los campos que faltan en vez de armar un documento incompleto", () => {
    const vacio = armarContenidoPaquete(crearExpediente(), { cerradoEn: CERRADO_EN });
    expect(vacio.ok).toBe(false);
    if (vacio.ok) throw new Error("no debería armar");
    expect(vacio.faltantes).toEqual(
      expect.arrayContaining([
        "numeroPropuesta",
        "plan",
        "identidad",
        "declaraciones",
        "declaracionOrigenLicito",
      ]),
    );
  });
});

describe("auxiliares de formato", () => {
  it("formatea la fecha como la muestran los formularios", () => {
    expect(formatearFecha("1990-04-17")).toBe("17/04/1990");
  });

  it("deriva el origen de fondos de la situación laboral declarada", () => {
    expect(origenDeFondos("Relación de dependencia")).toBe("Ingresos laborales en dependencia");
    expect(origenDeFondos("Jubilado/a")).toBe("Haberes jubilatorios");
    // Una situación que no esté en la tabla no puede dejar el campo vacío.
    expect(origenDeFondos("Cualquier otra cosa")).not.toBe("");
  });
});

// ---------------------------------------------------------------------------
// Transición
// ---------------------------------------------------------------------------

/**
 * D-08 · el paquete se cierra desde DECLARACIONES_OK, con el correlativo ya
 * acuñado por el servicio de documentos y sin ninguna operación de pago.
 */
function listoParaCerrar(): Expediente {
  return { ...expedienteEnDeclaracionesOk(), numeroPropuesta: NUMERO_PROPUESTA_FIJO };
}

describe("registrarPaqueteDocumental", () => {
  it("lleva el expediente de DECLARACIONES_OK a PAQUETE_GENERADO", () => {
    const resultado = registrarPaqueteDocumental(listoParaCerrar(), paqueteValido(), CERRADO_EN);
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;

    expect(resultado.expediente.estado).toBe("PAQUETE_GENERADO");
    expect(resultado.expediente.paqueteDocumental).toEqual(paqueteValido());
    // Historial append-only: se agrega una entrada, no se pisa ninguna.
    expect(resultado.expediente.historial.at(-1)).toEqual({ estado: "PAQUETE_GENERADO", en: CERRADO_EN });
  });

  it("rechaza códigos que no derivan del correlativo del expediente", () => {
    const ajeno: PaqueteDocumental = {
      ...paqueteValido(),
      fipf: { ...paqueteValido().fipf, codigo: codigoFipf("99999999") },
    };
    const resultado = registrarPaqueteDocumental(listoParaCerrar(), ajeno, CERRADO_EN);

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.error).toContain(NUMERO_PROPUESTA_FIJO);
  });

  it("rechaza que la Solicitud y el FIPF queden en versiones distintas", () => {
    const base = paqueteValido();
    const desparejo: PaqueteDocumental = { ...base, fipf: { ...base.fipf, version: base.fipf.version + 1 } };
    const resultado = registrarPaqueteDocumental(listoParaCerrar(), desparejo, CERRADO_EN);

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.error).toContain("un solo acto");
  });

  it("rechaza un documento sin huella digital (regla #4)", () => {
    const base = paqueteValido();
    const sinHash: PaqueteDocumental = { ...base, solicitud: { ...base.solicitud, hashSha256: "" } };
    const resultado = registrarPaqueteDocumental(listoParaCerrar(), sinHash, CERRADO_EN);

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.error).toContain("SHA-256");
  });

  it("no cierra el paquete sin correlativo ni desde un estado que ya lo pasó", () => {
    const base = listoParaCerrar();

    // Sin correlativo no hay códigos que derivar: el paquete no puede existir.
    const sinCorrelativo = registrarPaqueteDocumental(
      { ...base, numeroPropuesta: null },
      paqueteValido(),
      CERRADO_EN,
    );
    expect(sinCorrelativo.ok).toBe(false);

    // Desde PAQUETE_GENERADO no se puede volver a cerrar: regenerar exige una
    // versión y huellas nuevas, no un autobucle silencioso (regla #4).
    const yaCerrado = registrarPaqueteDocumental(base, paqueteValido(), CERRADO_EN);
    if (!yaCerrado.ok) throw new Error(yaCerrado.error);
    const otraVez = registrarPaqueteDocumental(yaCerrado.expediente, paqueteValido(), CERRADO_EN);
    expect(otraVez.ok).toBe(false);
  });

  it("nunca se llega al paquete desde DERIVADO_MANUAL (regla #5)", () => {
    const derivado = transicionarExpediente(
      { ...listoParaCerrar(), estado: "IDENTIDAD_VERIFICADA" },
      "DERIVADO_MANUAL",
    );
    if (!derivado.ok) throw new Error(derivado.error);

    const resultado = registrarPaqueteDocumental(derivado.expediente, paqueteValido(), CERRADO_EN);
    expect(resultado.ok).toBe(false);
  });
});
