/**
 * Adaptador mock de `RegistroCivilProvider` (ítem 33).
 *
 * Simula la consulta al Departamento de Identificaciones sin salir a la red.
 * Responde con los datos de las **personas de prueba** (`personas.ts`), que es
 * lo mismo que hace el mock de identidad: el demo tiene que ser coherente
 * consigo mismo, y un registro que devolviera otro nombre que el de la cédula
 * simulada sería una contradicción visible en pantalla.
 *
 * No hay adaptador oficial todavía y no se puede escribir: el contrato de API
 * del proveedor (convenio con Identificaciones o intermediario tipo Didit) no
 * está disponible, y **inventar endpoints es exactamente lo que CLAUDE.md
 * prohíbe**. Es la misma situación que Code100 y Bancard, que tienen puerto y
 * mock desde hace meses y adaptador oficial ninguno.
 *
 * Los tres estados del puerto se pueden ejercitar:
 *
 * - `ENCONTRADO` — cédula de una persona de prueba.
 * - `NO_ENCONTRADO` — cualquier otra cédula.
 * - `NO_DISPONIBLE` — palanca del panel de demo (`REGISTRO_CIVIL_CAIDO`). Hoy
 *   la persona tampoco puede continuar, pero el caso queda **distinguido en la
 *   evidencia** de un "no existe", que es lo que permitiría derivarla a
 *   revisión manual el día que esa salida exista (§6 del documento de
 *   recomendaciones). Sin la distinción, ni siquiera se podría saber a quién
 *   derivar.
 */
import { randomUUID } from "node:crypto";
import type {
  RegistroCivilProvider,
  ResultadoConsultaRegistroCivil,
} from "../../ports/registro-civil";
import { PERSONAS_DEMO } from "./personas";

/** Deja solo dígitos: `9.323.336` y `9323336` son la misma cédula. */
function normalizar(numeroCedula: string): string {
  return numeroCedula.replace(/\D/g, "");
}

export interface OpcionesRegistroCivilMock {
  /** Devuelve `true` para simular que el registro no está disponible. */
  readonly caido?: () => boolean;
  readonly nuevaReferencia?: () => string;
}

export function crearRegistroCivilMock(
  opciones: OpcionesRegistroCivilMock = {},
): RegistroCivilProvider {
  const caido = opciones.caido ?? (() => false);
  const nuevaReferencia = opciones.nuevaReferencia ?? (() => `RC-${randomUUID()}`);

  return {
    async consultarPorCedula(numeroCedula): Promise<ResultadoConsultaRegistroCivil> {
      if (caido()) {
        return {
          estado: "NO_DISPONIBLE",
          motivo: "El registro civil no respondió a tiempo.",
        };
      }

      const buscado = normalizar(numeroCedula);
      const persona = PERSONAS_DEMO.find(
        (candidata) => normalizar(candidata.identidad.numeroCedula) === buscado,
      );

      if (!persona) return { estado: "NO_ENCONTRADO", referenciaConsulta: nuevaReferencia() };

      const { identidad } = persona;
      return {
        estado: "ENCONTRADO",
        referenciaConsulta: nuevaReferencia(),
        // Solo los cinco campos del puerto. El registro real devolvería más;
        // el adaptador es el lugar donde se descarta lo que no se usa, para
        // que el dominio no llegue siquiera a verlo.
        datos: {
          numeroCedula: identidad.numeroCedula,
          nombres: identidad.nombres,
          apellidos: identidad.apellidos,
          fechaNacimiento: identidad.fechaNacimiento,
          sexo: identidad.sexo,
          nacionalidad: identidad.nacionalidad,
        },
      };
    },
  };
}
