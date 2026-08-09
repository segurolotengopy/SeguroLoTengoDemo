"use client";

import { FormularioVerificacionCanal } from "@/components/shared";
import { normalizarCelularParaguayo, PREFIJO_PAIS_PARAGUAY } from "@/domain/telefono";
// Desde `textos-p1` y no desde el caso de uso: este es un componente de
// cliente, e importar el caso de uso arrastraría `node:crypto` al bundle.
import { TEXTO_AUTORIZACION_P1 } from "@/domain/textos-p1";

/**
 * Formulario de P1 (docs/ESPECIFICACION_PANTALLAS.md → "P1 · Paso 1 de 9").
 *
 * La mecánica es la de `FormularioVerificacionCanal`, compartida con P4; acá
 * viven solo los textos y las rutas de P1, más el selector de país y el
 * checkbox de autorización, que P4 no tiene.
 */

const MENSAJES_P1: Readonly<Record<string, string>> = {
  AUTORIZACION_REQUERIDA: "Necesitás autorizar el uso del número para continuar.",
  DESTINO_INVALIDO:
    "Revisá el número: tiene que ser un celular paraguayo, por ejemplo 981 000 000.",
  PROPOSITO_INCORRECTO: "Ese código no sirve para verificar el WhatsApp.",
  ESTADO_INVALIDO: "Este proceso ya no está en el paso de verificación de WhatsApp.",
  SESION_INVALIDA: "Se perdió la sesión. Volvé a ingresar tu número.",
};

/** Paraguay es el único país habilitado: la especificación no contempla otro prefijo. */
function SelectorPais() {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="p1-pais" className="text-xs font-semibold text-etiqueta">
        País
      </label>
      <select
        id="p1-pais"
        disabled
        value="PY"
        className="h-11 rounded-lg border border-borde-sutil bg-superficie-suave px-3 text-sm font-semibold text-titulo"
      >
        <option value="PY">Paraguay {PREFIJO_PAIS_PARAGUAY}</option>
      </select>
    </div>
  );
}

export function FormularioVerificacionWhatsapp() {
  return (
    <FormularioVerificacionCanal
      idPrefijo="p1"
      rutas={{
        enviar: "/api/p1/otp/enviar",
        reenviar: "/api/p1/otp/reenviar",
        verificar: "/api/p1/otp/verificar",
      }}
      campoDestino="numero"
      paso1Titulo="Paso 1 — Ingresá tu número"
      etiquetaDestino="Número de WhatsApp"
      placeholderDestino="Ej.: 981 000 000"
      tipoCampo="tel"
      autoCompleteCampo="tel-national"
      prefijoCampo={<SelectorPais />}
      textoAutorizacion={TEXTO_AUTORIZACION_P1}
      botonEnviar="Enviar código"
      paso2Titulo="Paso 2 — Ingresá el código recibido"
      etiquetaCodigo="Código de verificación de WhatsApp"
      botonVerificar="Verificar WhatsApp"
      enlaceEditar="Editar número"
      leyendaEnviado={(destino) => `Código enviado al número ${destino}`}
      avisoEnviado="Te enviamos un código por WhatsApp."
      avisoReenviado="Te enviamos un código nuevo. El anterior dejó de servir."
      avisoVerificado="WhatsApp verificado."
      mensajes={MENSAJES_P1}
      validarDestino={(valor) => normalizarCelularParaguayo(valor).ok}
      advertencias={
        <>
          <p className="font-semibold text-titulo">No compartas el código con nadie.</p>
          <p>
            SeguroLoTengo, Interseguros y Alianza nunca te lo van a pedir por llamada. Si el código
            es incorrecto o deja de ser válido, te mostramos el motivo y podés pedir otro.
          </p>
        </>
      }
      hrefContinuar="/p2-plan"
      textoContinuar="Continuar →"
      notaContinuar="Se habilita únicamente después de verificar el WhatsApp."
    />
  );
}
