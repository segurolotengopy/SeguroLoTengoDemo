# Mensajería real para la demo a gerencia — qué falta y quién lo hace

Estado al 2026-08-14. El **código está completo en las dos vías** (rama
`feat/otp-whatsapp-modular`): con los flags activados, el demo envía los OTP a
destinatarios reales y el flujo se completa **sin el panel de demo**. Lo que
resta son pasos de credenciales/consola que requieren cuentas del dueño
(Meta y administración de AWS) — ninguno toca código.

Decisión registrada en la tabla de integraciones (filas 2, 3 y 4): WhatsApp
por **WhatsApp-Modular** (Meta Cloud API) y correo por **Amazon SES**;
la integración directa con **Infobip queda solo como backup** para pruebas y
producción.

## Flags del demo

| Variable | Efecto |
| :--- | :--- |
| `INTEGRATION_OTP=live` | OTP de P1 y OTP de la firma simulada salen por el otp-service de WhatsApp-Modular (`WHATSAPP_MODULAR_URL` + `WHATSAPP_MODULAR_TOKEN`). |
| `INTEGRATION_OTP_EMAIL=live` | OTP de P4 sale por Amazon SES (`OTP_EMAIL_FROM` = remitente verificado). Independiente del flag de WhatsApp. |

Config lista en `.claude/launch.json` → `segurolotengo-dev-mensajeria-real`
(ambos flags activos). En los canales en vivo el panel de demo **no muestra el
código** — está en el WhatsApp/casilla de la persona, que es el punto.

## Vía WhatsApp (bloqueada solo por Meta)

Guía detallada: `~/WhatsApp-Modular/docs/12-guia-operativa-meta.md`.

1. **Dueño — Bloques 0 a 3**: app de desarrollador de Meta, número de prueba
   (gratuito, sin Business Verification), plantilla `otp_verificacion`
   (AUTHENTICATION, es, 5 min). En modo prueba solo reciben los números que
   registres como destinatarios — registrá los celulares de gerencia.
2. **Dueño — `.env`** en `~/WhatsApp-Modular` (copiar `.env.example`):
   `WA_PHONE_NUMBER_ID`, `WA_ACCESS_TOKEN`, `WA_APP_SECRET`,
   `WA_VERIFY_TOKEN`, `API_BEARER_TOKEN` propios y `WA_DRY_RUN=false`.
3. Con eso, el mismo `npm run dev` del otp-service ya manda WhatsApp reales;
   del lado del demo solo hay que apuntar `WHATSAPP_MODULAR_TOKEN` al
   `API_BEARER_TOKEN` elegido. **Nada más que configurar acá.**
4. El número propio definitivo depende de la Business Verification (Bloque 6,
   camino crítico, documentos ya identificados como faltantes) — para la demo
   a gerencia alcanza el número de prueba.

El laboratorio Evolution **no** es una alternativa para esto: sus reglas de
contención prohíben OTPs por ese canal.

## Vía correo (bloqueada solo por IAM/SES, ~15 minutos de consola)

Los perfiles locales (`aab1-demo-deployer`, `aab1-demo-qa`) no tienen permisos
SES y no hay perfil de administración en esta máquina, así que estos pasos van
por consola/CloudShell con `Andres_Alberdi_1`:

1. **Crear y verificar la identidad del remitente** (SES → Identities →
   Create identity → Email address → `segurolotengo.py@gmail.com`), y hacer
   clic en el enlace del correo de verificación que llega a esa casilla.
   (Equivalente IaC: `infra/ses-correo-otp.tf`, ver notas del archivo.)
2. **Verificar también a los destinatarios de la demo**: la cuenta está en
   *sandbox* de SES y solo entrega a direcciones verificadas. Una identidad
   por cada casilla de gerencia que vaya a recibir el OTP (o pedir salida del
   sandbox para producción, caso de soporte de 24 h).
3. **Permitir `ses:SendEmail` al usuario local `aab1-demo-qa`**: aplicar el
   JSON de referencia actualizado `infra/iam-policy-qa-reference.json`
   (statement `SesEnvioOtpCorreo`) a su política en IAM.
4. Para el demo **desplegado** en Amplify: `terraform apply` de
   `infra/ses-correo-otp.tf` agrega el permiso al rol de cómputo (requiere
   sumarle `ses:*Identity*` al deployer o importar la identidad creada a
   mano — notas en el propio archivo).

Con 1–3 hechos, `segurolotengo-dev-mensajeria-real` manda correos reales
desde la máquina local. Aviso de deliverability: remitente gmail sin DKIM
propio puede caer en spam; para el piloto conviene un dominio propio.

## Qué se puede mostrar hoy mismo (sin Meta ni SES)

- El circuito WhatsApp completo contra el otp-service en **dry-run**: el
  envío real 202 con referencia `WM-OTP-…` y la validación de código con
  intentos, cooldown y expiración aplicados por el servicio.
- Todo el flujo P0→P9 en modo mock, como siempre.
