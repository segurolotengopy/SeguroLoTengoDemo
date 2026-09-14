/**
 * La lista de firmantes es **configuración** (D-13): Alianza puede firmar
 * prefirmado o junto con el cliente, y cambiar de una modalidad a otra tiene
 * que ser un cambio de dato, no una reescritura.
 *
 * Lo que estos tests fijan es lo que la configuración **no** puede romper. No
 * son preferencias de diseño: son el contrato de Code100 (CLAUDE.md →
 * "Contrato oficial de `SignatureProvider`") y la Ley 6822/21. Si alguien
 * reordena la lista o baja un nivel de firma "para simplificar", esto se pone
 * en rojo antes de que lo haga un auditor.
 */
import { describe, expect, it } from "vitest";
import {
  FIRMANTES_POR_DOCUMENTO,
  firmantesConjuntos,
  firmantesDe, VERSION_BLOQUE_FIRMAS } from "../firmantes-documento";

describe("firmantes por documento (D-13)", () => {
  it("el cliente firma primero y firma simple, en todo documento que firme", () => {
    // Invertir el orden pondría a la aseguradora firmando antes que el
    // titular, que es lo contrario del acto: el cliente acepta y las
    // instituciones refrendan.
    for (const firmantes of Object.values(FIRMANTES_POR_DOCUMENTO)) {
      const indiceCliente = firmantes.findIndex((firmante) => firmante.rol === "CLIENTE");
      if (indiceCliente === -1) continue;

      expect(indiceCliente).toBe(0);
      expect(firmantes[indiceCliente].nivel).toBe("SIMPLE");
    }
  });

  it("toda firma institucional es cualificada", () => {
    // Una firma institucional simple no serviría para lo que se le pide
    // (Ley 6822/21, arts. 38(1) y 42(5)).
    for (const firmantes of Object.values(FIRMANTES_POR_DOCUMENTO)) {
      for (const firmante of firmantes) {
        if (firmante.rol === "CLIENTE") continue;
        expect(firmante.nivel, `${firmante.rol} debería firmar cualificada`).toBe("CUALIFICADA");
      }
    }
  });

  it("ninguna institucional en modalidad CONJUNTO precede al cliente", () => {
    // `PREFIRMADO` sí puede ir antes: la firma ya está sobre el documento
    // cuando el cliente lo recibe, como una póliza modelo. `CONJUNTO` no,
    // porque se aplica en el mismo acto y después de la del cliente.
    for (const firmantes of Object.values(FIRMANTES_POR_DOCUMENTO)) {
      const indiceCliente = firmantes.findIndex((firmante) => firmante.rol === "CLIENTE");
      if (indiceCliente === -1) continue;

      const conjuntasAntes = firmantes
        .slice(0, indiceCliente)
        .filter((firmante) => firmante.modalidad === "CONJUNTO");
      expect(conjuntasAntes).toEqual([]);
    }
  });

  it("el paquete lo firman el cliente, Interseguros y Alianza, en ese orden", () => {
    // D-13 establece que Alianza firma la propuesta. La Matriz V4 §2 todavía
    // dice lo contrario ("Alianza no firma la propuesta salvo exigencia del
    // modelo"); manda D-13 y ALR-07 registra que Legal actualice la matriz.
    expect(firmantesDe("PAQUETE").map((firmante) => firmante.rol)).toEqual([
      "CLIENTE",
      "INTERSEGUROS",
      "ALIANZA",
    ]);
  });

  it("el CPC lo firma solo Alianza, y prefirmado", () => {
    // Matriz V4 §2, pantalla 6: "Cliente e Interseguros no firman el CPC por
    // defecto". El documento todavía no existe —es L5— pero su configuración
    // vive acá para no tener que decidir esto otra vez en otro lado.
    expect(firmantesDe("CPC").map((firmante) => firmante.rol)).toEqual(["ALIANZA"]);
    expect(firmantesDe("CPC")[0].modalidad).toBe("PREFIRMADO");
  });

  it("`firmantesConjuntos` trae las que hay que aplicar después de la del cliente", () => {
    const conjuntos = firmantesConjuntos("PAQUETE");

    // Ni el cliente —su firma no es "institucional"— ni las prefirmadas, que
    // ya están sobre el documento.
    expect(conjuntos.map((firmante) => firmante.rol)).toEqual(["INTERSEGUROS", "ALIANZA"]);
    expect(conjuntos.every((firmante) => firmante.modalidad === "CONJUNTO")).toBe(true);

    // El CPC no tiene ninguna: la de Alianza es prefirmada.
    expect(firmantesConjuntos("CPC")).toEqual([]);
  });

  it("cada firmante trae la leyenda que se imprime en el PDF", () => {
    // El bloque de firmas del documento sale de acá, no de una lista aparte:
    // cuando eran dos fuentes, el PDF podía anunciar un firmante que el
    // proveedor no aplicaba.
    for (const firmantes of Object.values(FIRMANTES_POR_DOCUMENTO)) {
      for (const firmante of firmantes) {
        expect(firmante.rotulo.trim()).not.toBe("");
        expect(firmante.leyenda.trim()).not.toBe("");
      }
    }
  });
});

describe("la leyenda del cliente (D-27)", () => {
  it("cita la Res. 210/2025 y no describe el flujo de un proveedor", () => {
    const cliente = firmantesDe("PAQUETE").find((f) => f.rol === "CLIENTE");
    expect(cliente?.leyenda).toContain("210/2025");
    expect(cliente?.leyenda).toContain("código de un solo uso");
    expect(cliente?.leyenda.toLowerCase()).not.toContain("enlace");
  });
  it("el bloque de firmas lleva versión, para que cada PDF diga con cuál se cerró", () => {
    expect(VERSION_BLOQUE_FIRMAS).toMatch(/^FIRMAS-v\d+$/);
  });
});
