/**
 * POST /api/asistente/mensaje — un turno de conversación con el asistente.
 *
 * Handler fino: valida la forma, limita por IP, delega al caso de uso y
 * traduce motivo → status. El cuerpo NO lleva ni recibe el expediente: la
 * conversación no está atada a la sesión del trámite a propósito (sección
 * «Asistente IA» de CLAUDE.md: desacoplado del flujo transaccional).
 *
 * Nada de lo que la persona escribe se registra en logs (CMP-16). Cuando el
 * caso de uso bloquea un dato sensible, la respuesta lleva `bloqueado: true` y
 * las categorías, nunca el texto.
 */
import { leerJson, resolverContextoHttp, respuestaJson } from "@/app/api/_http/contexto-peticion";
import { admitirEvento } from "@/app/api/_http/limitador";
import { dependenciasAsistente } from "@/app/api/asistente/_dependencias";
import { asistenteHabilitado } from "@/app/api/asistente/_habilitado";
import { conversarConAsistente, TEXTO_ASISTENTE_NO_DISPONIBLE } from "@/domain/asistente";
import { LIMITE_ASISTENTE } from "@/domain/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  if (!asistenteHabilitado()) return respuestaJson({ ok: false, motivo: "NO_DISPONIBLE" }, { status: 404 });

  const cuerpo = await leerJson(request);
  if (!cuerpo) return respuestaJson({ ok: false, motivo: "CUERPO_INVALIDO" }, { status: 400 });

  const { contexto } = resolverContextoHttp(request);
  const limite = admitirEvento(LIMITE_ASISTENTE, contexto.ip);
  if (!limite.permitido) {
    return respuestaJson(
      { ok: false, motivo: "DEMASIADOS_MENSAJES", segundosRestantes: limite.reintentarEnSegundos },
      { status: 429, cabeceras: { "retry-after": String(limite.reintentarEnSegundos) } },
    );
  }

  const resultado = await conversarConAsistente(dependenciasAsistente(), {
    conversacionId: cuerpo.conversacionId,
    perfilId: cuerpo.perfilId ?? null,
    texto: cuerpo.texto,
  });

  if (!resultado.ok) {
    const status =
      resultado.motivo === "TEXTO_LARGO"
        ? 413
        : resultado.motivo === "PERFIL_DESCONOCIDO"
          ? 404
          : resultado.motivo === "LIMITE"
            ? 429
            : resultado.motivo === "NO_DISPONIBLE" || resultado.motivo === "ERROR"
              ? 502
              : 400;
    return respuestaJson(
      {
        ok: false,
        motivo: resultado.motivo,
        ...(status === 502 ? { texto: TEXTO_ASISTENTE_NO_DISPONIBLE } : {}),
      },
      { status },
    );
  }

  if (resultado.bloqueado) {
    return respuestaJson({ ok: true, bloqueado: true, categorias: resultado.categorias, texto: resultado.texto, respaldo: [], derivacion: false });
  }

  return respuestaJson({
    ok: true,
    bloqueado: false,
    texto: resultado.texto,
    respaldo: resultado.respaldo,
    derivacion: resultado.derivacion,
    avisos: resultado.avisos,
  });
}
