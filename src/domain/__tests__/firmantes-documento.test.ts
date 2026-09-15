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
  firmantesDiferidos,
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

  it("ninguna institucional en modalidad CONJUNTO o DIFERIDO precede al cliente", () => {
    // `PREFIRMADO` sí puede ir antes: la firma ya está sobre el documento
    // cuando el cliente lo recibe, como una póliza modelo. `CONJUNTO` no,
    // porque se aplica en el mismo acto y después de la del cliente, y
    // `DIFERIDO` tampoco —se aplica después del pago, que ya exige la firma
    // del cliente— aunque acá se lo verifica igual, por si algún día deja de
    // ser cierto por construcción.
    for (const firmantes of Object.values(FIRMANTES_POR_DOCUMENTO)) {
      const indiceCliente = firmantes.findIndex((firmante) => firmante.rol === "CLIENTE");
      if (indiceCliente === -1) continue;

      const antesDelCliente = firmantes
        .slice(0, indiceCliente)
        .filter((firmante) => firmante.modalidad === "CONJUNTO" || firmante.modalidad === "DIFERIDO");
      expect(antesDelCliente).toEqual([]);
    }
  });

  it("el paquete lo firman el cliente e Interseguros; Alianza no firma la propuesta", () => {
    // D-08 enmendada (04-sep-2026) / D-42: la Res. 215/17 num. 11.15 prevé la
    // firma del corredor o del proponente, y nada exige la de la aseguradora
    // — la Matriz V4 §7 tenía razón. ALR-07 quedó cerrada sin cambiar la
    // matriz.
    expect(firmantesDe("PAQUETE").map((firmante) => firmante.rol)).toEqual([
      "CLIENTE",
      "INTERSEGUROS",
    ]);
  });

  it("Interseguros firma el paquete en modalidad DIFERIDO, después del pago (D-38, D-42)", () => {
    const interseguros = firmantesDe("PAQUETE").find((firmante) => firmante.rol === "INTERSEGUROS");
    expect(interseguros?.modalidad).toBe("DIFERIDO");
    expect(interseguros?.nivel).toBe("CUALIFICADA");
    expect(interseguros?.leyenda).toContain("después del pago");
  });

  it("el CPC lo firma solo Alianza, y prefirmado", () => {
    // Matriz V4 §2, pantalla 6: "Cliente e Interseguros no firman el CPC por
    // defecto". Sigue como está: D-42 mueve quién lo genera y por dónde
    // llega la firma de Alianza, no esta configuración.
    expect(firmantesDe("CPC").map((firmante) => firmante.rol)).toEqual(["ALIANZA"]);
    expect(firmantesDe("CPC")[0].modalidad).toBe("PREFIRMADO");
  });

  it("`firmantesConjuntos` ya no trae ninguna institucional del paquete", () => {
    // Quedó de la versión anterior a D-08 enmendada, cuando Interseguros y
    // Alianza firmaban junto con el cliente. Hoy ningún firmante institucional
    // está en modalidad CONJUNTO.
    expect(firmantesConjuntos("PAQUETE")).toEqual([]);
    expect(firmantesConjuntos("CPC")).toEqual([]);
  });

  it("`firmantesDiferidos` trae la firma que se aplica después del pago", () => {
    const diferidos = firmantesDiferidos("PAQUETE");

    expect(diferidos.map((firmante) => firmante.rol)).toEqual(["INTERSEGUROS"]);
    expect(diferidos.every((firmante) => firmante.modalidad === "DIFERIDO")).toBe(true);

    // El CPC no tiene ninguna: la de Alianza es prefirmada.
    expect(firmantesDiferidos("CPC")).toEqual([]);
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
