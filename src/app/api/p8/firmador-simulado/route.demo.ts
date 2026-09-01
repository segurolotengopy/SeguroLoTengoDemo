/**
 * `POST /api/p8/firmador-simulado` — la ventana de Code100, dibujada dentro de
 * P8 en vez de en el panel de demo.
 *
 * ## Por qué existe
 *
 * En el flujo real, el tercer OTP —el de la firma— **no pasa por
 * SeguroLoTengo**: la persona abre el enlace que le mandó Code100, tipea el
 * código allá y firma allá. Por eso P8 no tiene ningún campo de código y solo
 * sondea. Eso no cambia.
 *
 * Lo que cambia es dónde se simula el otro lado. Hasta ahora el único lugar
 * era `/api/demo-panel/firma`, que exige la cookie del panel: para completar
 * la firma había que abrir el panel de demo, y en una demostración por pantalla
 * compartida eso significa mostrarle a la gerencia la consola de trucos justo
 * en el momento más importante del recorrido. Este endpoint hace exactamente
 * lo mismo, pero desde un modal de P8 que se presenta como lo que es: la
 * ventana del firmador, no una pantalla de SeguroLoTengo.
 *
 * ## Lo que sigue siendo cierto
 *
 * 1. **Nunca devuelve el código.** Ni acá ni en ninguna respuesta. El código
 *    lo emite la sesión simulada y llega por WhatsApp
 *    (`INTEGRATION_OTP=live`) o se lee en el panel de demo. Regla inviolable
 *    #2: por la API del flujo no sale jamás.
 * 2. **No firma por su cuenta.** Verifica el código con las mismas reglas que
 *    los otros dos OTP: 6 dígitos, uso único, 5 minutos, 3 intentos. Quien
 *    valida sigue siendo la sesión simulada de Code100.
 * 3. **No puede dejar una firma a medias** (regla inviolable #3): el sellado
 *    de los dos documentos es una sola escritura, garantizada por el tipo
 *    `Firma`.
 * 4. **No existe fuera de `DEMO_MODE`.** Extensión `route.demo.ts`: con el
 *    flag apagado la ruta no se compila (ver `next.config.ts`), y además hay
 *    guarda de runtime.
 *
 * ## La diferencia de seguridad con `/api/demo-panel/firma`
 *
 * Aquel endpoint recibe el `idCode100` del cuerpo y se protege con la cookie
 * del panel. Este **no acepta ningún identificador del cliente**: saca el acto
 * de firma del expediente de la sesión del flujo. Un pedido solo puede afectar
 * al expediente de quien lo manda, que es la propiedad que hace innecesaria la
 * clave del panel acá.
 */
import { COOKIE_SESION, leerJson, resolverContextoHttp, respuestaJson } from "@/app/api/_http/contexto-peticion";
import { esModoDemo } from "@/app/demo-panel/_sesion";
import {
  abrirEnlaceDeFirmaMock,
  cerrarSinFirmarMock,
  firmarEnCode100Mock,
} from "@/adapters/mock/signature-provider";
import { obtenerOtpFirmaRemoto } from "@/adapters/registro";
import { crearExpedienteRepository } from "@/repositories";

export const dynamic = "force-dynamic";

/**
 * `ABRIR` y `REEMITIR` hacen lo mismo salvo en una cosa, y por eso son dos
 * acciones y no un booleano: `ABRIR` lo manda la pantalla al montarse —así que
 * puede llegar duplicado por el doble montaje de StrictMode y se deduplica—,
 * mientras que `REEMITIR` lo manda *Pedir un código nuevo* y siempre acuña otro.
 */
const ACCIONES = ["ABRIR", "REEMITIR", "FIRMAR", "RECHAZAR"] as const;
type Accion = (typeof ACCIONES)[number];

function esAccion(valor: unknown): valor is Accion {
  return ACCIONES.some((accion) => accion === valor);
}

export async function POST(request: Request): Promise<Response> {
  if (!esModoDemo()) {
    return respuestaJson({ ok: false, motivo: "NO_DISPONIBLE" }, { status: 404 });
  }

  const cuerpo = await leerJson(request);
  if (!esAccion(cuerpo?.accion)) {
    return respuestaJson({ ok: false, motivo: "PEDIDO_INVALIDO" }, { status: 400 });
  }

  const { contexto, expedienteId } = resolverContextoHttp(request);
  if (!expedienteId) {
    return respuestaJson({ ok: false, motivo: "SESION_INVALIDA" }, { status: 400 });
  }
  const cookies = [{ nombre: COOKIE_SESION, valor: contexto.sesionId }];

  // El `idCode100` sale del expediente de la sesión, nunca del cuerpo: es lo
  // que impide que un pedido toque el acto de firma de otra persona.
  const expediente = await crearExpedienteRepository().obtenerPorId(expedienteId);
  if (!expediente) {
    return respuestaJson({ ok: false, motivo: "EXPEDIENTE_NO_ENCONTRADO" }, { status: 404, cookies });
  }

  const acto = expediente.actoDeFirma;
  if (!acto) {
    return respuestaJson({ ok: false, motivo: "FIRMA_NO_INICIADA" }, { status: 409, cookies });
  }

  const otpRemoto = obtenerOtpFirmaRemoto();

  if (cuerpo.accion === "ABRIR" || cuerpo.accion === "REEMITIR") {
    const resultado = await abrirEnlaceDeFirmaMock(acto.idCode100, {
      otpRemoto,
      origen: cuerpo.accion === "ABRIR" ? "MONTAJE_DE_PANTALLA" : "PEDIDO_EXPLICITO",
    });
    return resultado.ok
      ? respuestaJson({ ok: true, expiraEn: resultado.expiraEn }, { cookies })
      : respuestaJson({ ok: false, motivo: resultado.motivo }, { status: 409, cookies });
  }

  // Rechazar es lo que hace la persona que abre el enlace y decide no firmar.
  // Cierra la sesión sin firma y el sondeo de P8 lo informa como acto no
  // completado; desde ahí se puede pedir un enlace nuevo.
  if (cuerpo.accion === "RECHAZAR") {
    const cerrada = await cerrarSinFirmarMock(
      acto.idCode100,
      "RECHAZADA",
      "La persona rechazó la firma en la ventana del firmador.",
    );
    return cerrada
      ? respuestaJson({ ok: true }, { cookies })
      : respuestaJson({ ok: false, motivo: "YA_CERRADA" }, { status: 409, cookies });
  }

  const codigo = typeof cuerpo.codigo === "string" ? cuerpo.codigo.trim() : "";
  if (codigo === "") {
    return respuestaJson({ ok: false, motivo: "CODIGO_REQUERIDO" }, { status: 400, cookies });
  }

  const resultado = await firmarEnCode100Mock(acto.idCode100, codigo, {
    otpRemoto,
    // Palanca de demostración de la regla inviolable #3: corta el sellado con
    // la primera huella calculada y la segunda no. Lo que hay que mirar es lo
    // que pasa después — como nada se escribió todavía, la sesión queda **sin
    // firma y con los dos documentos sin firmar**, no con uno solo.
  });

  if (!resultado.ok) {
    return respuestaJson(
      {
        ok: false,
        motivo: resultado.motivo,
        ...(resultado.intentosRestantes !== undefined
          ? { intentosRestantes: resultado.intentosRestantes }
          : {}),
      },
      { status: 409, cookies },
    );
  }

  // Las dos huellas juntas o ninguna. Acá no vuelve el código del OTP.
  //
  // El expediente todavía está en PAQUETE_GENERADO: quien lo pasa a
  // FIRMADO_CLIENTE y de ahí a FIRMADO es el sondeo de `/api/p8/estado`, igual
  // que si la persona hubiera firmado en la ventana real de Code100. Este
  // endpoint no transiciona nada.
  return respuestaJson(
    {
      ok: true,
      firmadoEn: resultado.firma.firmadoEn,
      hashDocumentoFirmado: resultado.firma.hashDocumentoFirmado,
    },
    { cookies },
  );
}
