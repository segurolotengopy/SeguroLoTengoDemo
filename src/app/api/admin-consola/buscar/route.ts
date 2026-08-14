/**
 * `GET /api/admin-consola/buscar` — búsqueda de expedientes
 * (`docs/CONSOLA_ADMINISTRATIVA.md` §3).
 *
 * Criterios (uno por consulta, el que la consola tenga cargado):
 *
 *   ?criterio=cedula&valor=9323336
 *   ?criterio=caso&valor=CASO-2026-418302
 *   ?criterio=estado&valor=DERIVADO_MANUAL&desde=2026-08-01&hasta=2026-08-31
 *
 * Y `&nombre=gorena` como filtro adicional sobre el resultado.
 *
 * Solo lectura: no transiciona ni escribe nada.
 *
 * **Qué devuelve:** el listado con el titular enmascarado, tal como pide la
 * especificación. Los datos completos —incluidas las respuestas médicas y la
 * condición PEP— viven en el endpoint de detalle, que es donde el documento
 * autoriza mostrarlos.
 */
import { respuestaJson } from "@/app/api/_http/contexto-peticion";
import { rechazoDeAcceso } from "@/app/api/admin-consola/_guardia";
import {
  armarResultados,
  estadoBloqueaRegistro,
  filtrarPorNombre,
} from "@/domain/consola-administrativa";
import { correlativoDeCodigo } from "@/domain/documentos";
import { ESTADOS_EXPEDIENTE } from "@/domain/tipos";
import type { EstadoExpediente, Expediente } from "@/domain/tipos";
import { crearExpedienteRepository } from "@/repositories";

export const dynamic = "force-dynamic";

/**
 * Estados buscables: **todos**, derivados del tipo.
 *
 * Antes era una lista escrita a mano y se desactualizó al agregar
 * `ASISTENCIA_IDENTIDAD`: el estado existía, había expedientes en él, y la
 * consola no podía listarlos. Ahora agregar un estado al tipo lo hace buscable
 * automáticamente.
 */
const ESTADOS_VALIDOS: readonly EstadoExpediente[] = ESTADOS_EXPEDIENTE;

function esEstado(valor: string): valor is EstadoExpediente {
  return (ESTADOS_VALIDOS as readonly string[]).includes(valor);
}

export async function GET(request: Request): Promise<Response> {
  const rechazo = await rechazoDeAcceso();
  if (rechazo) return rechazo;

  const url = new URL(request.url);
  const criterio = url.searchParams.get("criterio") ?? "";
  const valor = (url.searchParams.get("valor") ?? "").trim();
  const nombre = url.searchParams.get("nombre") ?? "";

  if (valor === "") {
    return respuestaJson({ ok: false, motivo: "VALOR_REQUERIDO" }, { status: 400 });
  }

  const repositorio = crearExpedienteRepository();
  let encontrados: readonly Expediente[];
  let contexto: readonly Expediente[];

  switch (criterio) {
    case "cedula": {
      // Los dígitos por si alguien pega la cédula con puntos: `9.323.336`.
      const cedula = valor.replace(/\D/g, "");
      encontrados = await repositorio.buscarPorCedula(cedula);
      // Contexto = los mismos: para decidir cuál bloquea hace falta ver toda
      // la cadena de expedientes de esa persona, que es exactamente esto.
      contexto = encontrados;
      break;
    }
    case "caso": {
      // Los tres formatos de la especificación: `PROP-`/`FIPF-` se traducen
      // al correlativo de la propuesta; cualquier otro valor se busca como
      // número de caso de derivación (`CASO-...`).
      const codigo = valor.toUpperCase();
      const correlativo = correlativoDeCodigo(codigo);
      encontrados = correlativo
        ? await repositorio.buscarPorNumeroPropuesta(correlativo)
        : await repositorio.buscarPorNumeroCaso(codigo);
      // Para saber si un caso derivado sigue bloqueando hay que mirar sus
      // hermanos por cédula, no solo el expediente encontrado.
      const cedula = encontrados[0]?.identidad?.numeroCedula;
      contexto = cedula ? await repositorio.buscarPorCedula(cedula) : encontrados;
      break;
    }
    case "estado": {
      if (!esEstado(valor)) {
        return respuestaJson({ ok: false, motivo: "ESTADO_INVALIDO" }, { status: 400 });
      }
      encontrados = await repositorio.buscarPorEstado(valor, {
        desde: url.searchParams.get("desde") ?? undefined,
        hasta: url.searchParams.get("hasta") ?? undefined,
      });
      contexto = encontrados;
      break;
    }
    default:
      return respuestaJson({ ok: false, motivo: "CRITERIO_INVALIDO" }, { status: 400 });
  }

  const filtrados = filtrarPorNombre(encontrados, nombre);

  // Un sucesor de reinicio nace `INICIADO` y sin cédula, así que `contexto`
  // (armado por cédula) no lo contiene, y sin él el badge `bloqueaRegistro`
  // marcaría como bloqueante un expediente ya superado. Mismo criterio que la
  // vista de detalle: se juntan los sucesores de los que están en estado
  // bloqueante antes de evaluar.
  const conEstadoBloqueante = contexto.filter((expediente) =>
    estadoBloqueaRegistro(expediente.estado),
  );
  const sucesores = (
    await Promise.all(
      conEstadoBloqueante.map((expediente) => repositorio.buscarSucesores(expediente.id)),
    )
  ).flat();
  const idsEnContexto = new Set(contexto.map((expediente) => expediente.id));
  const contextoConSucesores = [
    ...contexto,
    ...sucesores.filter((sucesor) => !idsEnContexto.has(sucesor.id)),
  ];

  // Sin `estadosTerminales` en la respuesta: era un campo muerto (la UI tiene
  // su propia lista de estados con badge) y además engañoso — `EMITIDO` es
  // terminal pero no bloquea, y `VENCIDO`/`DEVOLUCION_EN_TRAMITE` bloquean sin
  // ser terminales. El badge correcto ya viaja por fila en `bloqueaRegistro`.
  return respuestaJson({
    ok: true,
    resultados: armarResultados(filtrados, contextoConSucesores),
  });
}
