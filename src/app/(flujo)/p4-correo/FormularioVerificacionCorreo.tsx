"use client";

import { FormularioVerificacionCanal } from "@/components/shared";
import { normalizarCorreo } from "@/domain/correo";

/**
 * Formulario de P4 (docs/ESPECIFICACION_PANTALLAS.md → "P4 · Paso 4 de 9":
 * *"estructura idéntica a P1 pero para correo electrónico"*).
 *
 * Usa el mismo componente que P1 contra el mismo motor de dominio; lo único
 * propio son los textos y las rutas. No tiene checkbox: el consentimiento de
 * tratamiento de datos ya se tomó en P3.
 */

const MENSAJES_P4: Readonly<Record<string, string>> = {
  DESTINO_INVALIDO: "Revisá la dirección: tiene que ser un correo válido, por ejemplo nombre@correo.com.",
  // Este es el mensaje que ve alguien que intenta usar el código de WhatsApp
  // acá: los dos OTP son independientes y no son intercambiables.
  PROPOSITO_INCORRECTO: "Ese código no sirve para verificar el correo. Es diferente al de WhatsApp.",
  ESTADO_INVALIDO: "Este proceso ya no está en el paso de verificación de correo.",
  SESION_INVALIDA: "Se perdió la sesión. Volvé a empezar desde la verificación de WhatsApp.",
};

export function FormularioVerificacionCorreo() {
  return (
    <FormularioVerificacionCanal
      idPrefijo="p4"
      rutas={{
        enviar: "/api/p4/otp/enviar",
        reenviar: "/api/p4/otp/reenviar",
        verificar: "/api/p4/otp/verificar",
      }}
      campoDestino="correo"
      paso1Titulo="Paso 1 — Ingresá tu correo"
      etiquetaDestino="Correo electrónico"
      placeholderDestino="Ej.: nombre@correo.com"
      tipoCampo="email"
      autoCompleteCampo="email"
      botonEnviar="Enviar código"
      paso2Titulo="Paso 2 — Ingresá el código recibido"
      etiquetaCodigo="Código de verificación del correo"
      botonVerificar="Verificar correo"
      enlaceEditar="Editar correo"
      leyendaEnviado={(destino) => `Código enviado a ${destino}`}
      avisoEnviado="Te enviamos un código a tu correo."
      avisoReenviado="Te enviamos un código nuevo. El anterior dejó de servir."
      avisoVerificado="Correo verificado."
      mensajes={MENSAJES_P4}
      validarDestino={(valor) => normalizarCorreo(valor).ok}
      advertencias={
        <>
          <p className="font-semibold text-titulo">
            Este código es diferente al que recibiste por WhatsApp.
          </p>
          <p>
            A esta dirección se van a enviar las comunicaciones del proceso y, después de la
            emisión, los documentos electrónicos. No compartas el código con nadie: SeguroLoTengo,
            Interseguros y Alianza nunca te lo van a pedir por llamada.
          </p>
        </>
      }
      hrefContinuar="/p5-identidad"
      textoContinuar="Continuar →"
      notaContinuar="Se habilita únicamente después de verificar el correo."
    />
  );
}
