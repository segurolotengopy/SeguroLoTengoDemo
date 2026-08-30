/**
 * Los textos de aclaración no inventan datos de contacto.
 *
 * La regla es D-19: lo que todavía no tenemos viaja como `null` y la
 * pantalla lo omite. Es más fuerte que una preferencia de redacción — un
 * canal de reclamos que no existe hace que el reclamo se pierda en
 * silencio, y publicar uno es peor que no publicar ninguno.
 *
 * `higiene-de-citas.test.ts` ya prohíbe el dominio concreto que se usaba
 * antes; esto vigila el comportamiento: que el documento se arme con lo que
 * hay configurado y no con un texto fijo.
 */
import { afterEach, describe, expect, it } from "vitest";
import { CORREO_RETRACTO_Y_DATOS, INTERSEGUROS } from "../entidades";
import { aclaracionConsultasReclamos, documentosAclaracion } from "../textos-aclaraciones";

function parrafosDe(documento: { secciones: readonly { parrafos: readonly string[] }[] }): string {
  return documento.secciones.flatMap((seccion) => seccion.parrafos).join("\n");
}

const CANALES = "Canales de atención";

function canales(): readonly string[] {
  const seccion = aclaracionConsultasReclamos().secciones.find((s) => s.titulo === CANALES);
  if (!seccion) throw new Error(`El documento perdió la sección «${CANALES}»`);
  return seccion.parrafos;
}

describe("aclaración de consultas y reclamos", () => {
  const original = process.env.NEXT_PUBLIC_INTERSEGUROS_CORREO;

  afterEach(() => {
    if (original === undefined) delete process.env.NEXT_PUBLIC_INTERSEGUROS_CORREO;
    else process.env.NEXT_PUBLIC_INTERSEGUROS_CORREO = original;
  });

  it("publica siempre la atención presencial y el WhatsApp, que no dependen de datos pendientes", () => {
    const texto = canales().join("\n");
    expect(texto).toContain(INTERSEGUROS.domicilio);
    expect(texto).toContain("WhatsApp");
  });

  it("omite la entidad que no tiene ningún medio configurado", () => {
    delete process.env.NEXT_PUBLIC_INTERSEGUROS_CORREO;
    delete process.env.NEXT_PUBLIC_INTERSEGUROS_TELEFONO;

    // Interseguros sigue apareciendo como domicilio de atención presencial,
    // pero no como una línea de contacto vacía o con un marcador.
    const lineasDeContacto = canales().filter((linea) => linea.includes(" — "));
    expect(lineasDeContacto.some((linea) => linea.startsWith(INTERSEGUROS.razonSocial))).toBe(false);
  });

  it("incorpora el correo apenas se lo configura, sin tocar código", () => {
    process.env.NEXT_PUBLIC_INTERSEGUROS_CORREO = "atencion@ejemplo-de-prueba.test";

    expect(canales().join("\n")).toContain("atencion@ejemplo-de-prueba.test");
  });

  it("no deja ningún marcador de dato faltante a la vista", () => {
    const texto = parrafosDe(aclaracionConsultasReclamos());

    for (const marcador of ["[", "]", "XXXX", "pendiente", "por definir"]) {
      expect(texto).not.toContain(marcador);
    }
  });
});

describe("aviso de privacidad", () => {
  it("dirige los derechos sobre datos al único correo que la matriz da por cerrado", () => {
    expect(parrafosDe(documentosAclaracion().avisoPrivacidad)).toContain(CORREO_RETRACTO_Y_DATOS);
  });
});

describe("catálogo de aclaraciones", () => {
  it("resuelve los seis documentos con id, título y contenido", () => {
    for (const [clave, documento] of Object.entries(documentosAclaracion())) {
      expect(documento.id, clave).not.toBe("");
      expect(documento.titulo, clave).not.toBe("");
      expect(documento.secciones.length, clave).toBeGreaterThan(0);
      expect(parrafosDe(documento).trim(), clave).not.toBe("");
    }
  });
});
