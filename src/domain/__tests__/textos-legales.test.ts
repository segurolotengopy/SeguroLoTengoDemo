/**
 * Textos informativos con consecuencia legal (L6 · filas 1, 64, 84 y 85).
 *
 * Lo que se prueba acá no es la redacción —esa la aprueba Legal— sino las dos
 * propiedades que el código sí puede sostener: que **lo que la matriz manda
 * decir esté dicho**, y que **lo que falta siga marcado como falta**.
 *
 * El segundo es el que importa vigilar. El día que alguien complete el plazo
 * del retracto va a tener que tocar este test, y eso es exactamente lo que se
 * busca: que reemplazar un marcador por un número sea una decisión visible en
 * el diff y no un cambio de una línea que pasa desapercibido.
 */
import { describe, expect, it } from "vitest";
import { ALIANZA, INTERSEGUROS } from "../entidades";
import {
  BLOQUES_PRIVACIDAD,
  FALTA_DEFINICION_LEGAL,
  IDENTIFICACION_CANAL,
  PARRAFOS_COOKIES,
  PARRAFOS_RETRACTO,
} from "../textos-legales";

describe("fila 1 · identificación del canal", () => {
  it("nombra a las dos entidades con su razón social y la matrícula", () => {
    expect(IDENTIFICACION_CANAL).toContain(INTERSEGUROS.razonSocial);
    expect(IDENTIFICACION_CANAL).toContain(ALIANZA.razonSocial);
    expect(IDENTIFICACION_CANAL).toContain(String(INTERSEGUROS.matriculaSis));
  });

  it("dice lo que la fila 1 pide y una cabecera con dos logos no alcanza a decir", () => {
    // La fila manda informar que el canal **no es la aseguradora**. Sin esta
    // frase el texto sería una presentación, no el cumplimiento de la fila.
    expect(IDENTIFICACION_CANAL).toContain("no es una compañía de seguros");
  });
});

describe("fila 64 · derecho de retracto", () => {
  it("informa que es sin causa y sin penalidad", () => {
    const completo = PARRAFOS_RETRACTO.join(" ");
    expect(completo).toContain("sin expresar causa");
    expect(completo).toContain("sin penalidad");
  });

  it("deja el plazo y su cómputo marcados como pendientes, no inventados", () => {
    const completo = PARRAFOS_RETRACTO.join(" ");
    // Dos huecos: cuánto dura y desde cuándo corre. La fila 64 manda informar
    // el derecho y no fija ninguno de los dos.
    const marcadores = completo.split(FALTA_DEFINICION_LEGAL).length - 1;
    expect(marcadores).toBe(2);
  });

  it("no contiene ningún plazo en días o meses", () => {
    // La red de seguridad del test anterior: si alguien escribe "siete días"
    // en cualquier parte del texto, esto lo atrapa aunque haya dejado los
    // marcadores en su lugar.
    const completo = PARRAFOS_RETRACTO.join(" ").toLowerCase();
    expect(completo).not.toMatch(/\b\d+\s*(días?|meses?|horas?)\b/);
    expect(completo).not.toMatch(/\b(un|dos|tres|cuatro|cinco|seis|siete|diez|quince|treinta)\s+(días?|meses?)\b/);
  });

  it("distingue el caso con cobro del caso sin cobro", () => {
    // Es la diferencia que evita prometer una devolución que no corresponde:
    // sin cobro acreditado no hay nada que devolver (D-02/D-08).
    const completo = PARRAFOS_RETRACTO.join(" ");
    expect(completo).toContain("no hay nada que devolver");
    expect(completo).toContain(ALIANZA.razonSocial);
  });
});

describe("fila 84 · datos personales", () => {
  it("declara el aislamiento de salud y PEP, que es la regla inviolable #7", () => {
    const completo = BLOQUES_PRIVACIDAD.map(({ texto }) => texto).join(" ");
    expect(completo).toContain("no salen hacia analítica");
    expect(completo).toContain("inteligencia artificial");
  });

  it("declara que no se almacenan los datos de la tarjeta, que es la regla #6", () => {
    const completo = BLOQUES_PRIVACIDAD.map(({ texto }) => texto).join(" ");
    expect(completo).toContain("no se almacenan en ningún momento");
  });

  it("enumera los cuatro derechos sobre los datos", () => {
    const completo = BLOQUES_PRIVACIDAD.map(({ texto }) => texto).join(" ");
    for (const derecho of ["acceso", "actualización", "rectificación", "eliminación"]) {
      expect(completo, `falta el derecho de ${derecho}`).toContain(derecho);
    }
  });

  it("deja los plazos de conservación marcados como pendientes", () => {
    const conservacion = BLOQUES_PRIVACIDAD.find(({ titulo }) =>
      titulo.toLowerCase().includes("conservamos"),
    );
    expect(conservacion?.texto).toContain(FALTA_DEFINICION_LEGAL);
  });
});

describe("fila 85 · cookies", () => {
  it("dice cuántas son, para qué sirven y cuánto duran", () => {
    const completo = PARRAFOS_COOKIES.join(" ");
    expect(completo).toContain("tres cookies propias");
    expect(completo).toContain("ocho horas");
  });

  it("afirma que no hay analítica ni publicidad, que es lo que justifica no dar opciones", () => {
    // Si esta afirmación dejara de ser cierta, el aviso sin panel dejaría de
    // cumplir la fila 85. Es la premisa de la decisión, no un adorno.
    const completo = PARRAFOS_COOKIES.join(" ");
    expect(completo).toContain("No usamos cookies de analítica, de publicidad ni de terceros");
  });

  it("se compromete a pedir permiso antes de incorporar alguna", () => {
    expect(PARRAFOS_COOKIES.join(" ")).toContain("te la vamos a pedir antes de instalarla");
  });
});
