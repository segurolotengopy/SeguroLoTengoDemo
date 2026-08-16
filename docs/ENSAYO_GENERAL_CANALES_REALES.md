# Ensayo general del recorrido completo con canales reales

**Fecha:** 16 de agosto de 2026 · **Expediente:** `5c56e234-37af-46f5-993a-df4b22dbde63`
· **Propuesta:** `45020093` · **Estado final:** `EMITIDO`

Primer recorrido P0→P9 completo con los tres OTP viajando por canales de
verdad y **sin leer ningún código del panel de demo**. Sirve como evidencia
de que los adaptadores vivos (`INTEGRATION_OTP=live`,
`INTEGRATION_OTP_EMAIL=live`) sostienen el flujo entero, no solo el envío
aislado.

## Configuración

| Componente | Modo |
| :---- | :---- |
| OTP de celular (P1) y de firma (P8) | **Real** — WhatsApp-Modular → Meta Cloud API, servicio publicado en `wamodular.duckdns.org` |
| OTP de correo (P4) | **Real** — Amazon SES, remitente verificado |
| Identidad (P5), pago (P7), firmador Code100 (P8), emisión (P9) | Mock, como en toda la demo |

Destinatario: celular boliviano `+591 ••• ••• 339` (registrado en Meta como
número de prueba, con conversación iniciada por la persona) y casilla
`s••••••@gmail.com` (identidad verificada en SES).

## Recorrido

| Paso | Resultado | Canal |
| :---- | :---- | :---- |
| P1 · celular | Verificado; expediente a `CANAL_WA_VERIFICADO` | **real** |
| P2 · plan | CONFÍO+, premio ₲ 475.000, oferta `OFERTA-CONFIO-v1` | interno |
| P3 · consentimiento | Aceptado, versión `P3-AUTORIZACION-INICIAL-v1` | interno |
| P4 · correo | Verificado; `CANAL_EMAIL_VERIFICADO` | **real** |
| P5 · identidad | Mónica Mariana Gorena Tapia, C.I. 9.323.336, 36 años, edad en rango | mock |
| P6 · declaraciones | Las ocho compatibles → `DECLARACIONES_OK`, elegible para emisión automática | interno |
| P7 · pago | QR confirmado, `MOCK-BANCARD-B32DF98E-7E54`, propuesta 45020093 | mock |
| P8 · paquete | `PROP-45020093` y `FIPF-45020093`, versión 1, hash SHA-256 por documento | interno |
| P8 · firma | Firmados en un solo acto (`MOCK-CODE100-A89CD877-49EA`) | **real** (OTP) |
| P9 · cierre | `EMITIDO`; póliza `EN_PROCESO_DE_EMISION` conservando el correlativo; factura `PENDIENTE` | interno |

## Reglas que el ensayo verificó en condiciones reales

Estas no se pueden comprobar con el panel, porque ahí el código está siempre
a mano:

1. **Vigencia de 5 minutos (regla inviolable #1).** Vencieron dos códigos —el
   primero de correo y el primero de firma— mientras se esperaba que la
   persona los leyera. El sistema los rechazó con `EXPIRADO` / `OTP_EXPIRADO`
   y hubo que reemitirlos.
2. **La reemisión anula el código anterior.** El reenvío de P4 rotó el código:
   el segundo verificó, el primero ya no servía.
3. **Solo el titular puede avanzar.** Ni siquiera quien conducía el ensayo
   pudo continuar sin que la persona leyera los códigos en su teléfono y su
   casilla. Es la propiedad que hace que el panel deje de ser un atajo cuando
   el canal es real.
4. **Enmascarado en P9 (regla #10).** `93•••••`, `+591 ••• ••• 339`,
   `s••••••@gmail.com`.
5. **Un correlativo, dos prefijos, y la póliza conserva el número de la
   propuesta** (`numeroPoliza` = `numeroPropuesta` = 45020093).

## Limitación conocida de la ejecución

El tramo P2→P9 se ejecutó llamando a los Route Handlers con las cookies del
expediente, no clickeando la interfaz: la sesión es `HttpOnly` y vivía en el
navegador de la persona que hizo P1. Las pantallas usan exactamente esos
mismos endpoints, y la cobertura de UI la da la batería de Playwright
(`e2e/01-camino-feliz.spec.ts`, en verde en la misma jornada), así que la
evidencia se complementa en vez de solaparse.

## Pendientes que este ensayo no cubre

- `delivered` por webhook de Meta (criterio de salida formal de la Fase 0 de
  WhatsApp-Modular).
- Business Verification de Meta → plantilla AUTHENTICATION definitiva, que
  reemplaza el modo interino `template_header`.
- Salida del sandbox de SES y dominio propio con DKIM.
