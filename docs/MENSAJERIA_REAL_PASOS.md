# Mensajería real para la demo a gerencia — qué falta y quién lo hace

> **Actualización 2026-08-19 — LEER ANTES DE MANDAR UN OTP DE WHATSAPP.**
> El modo de envío del `otp-service` **cambió**: lo que dicen las
> actualizaciones de más abajo sobre `template_header` / `requerimiento` ya no
> describe lo que corre hoy en la VM.
>
> En una línea: hoy el OTP sale como **texto de sesión**, y eso **exige que el
> destinatario le haya escrito primero** al número de prueba. Si no lo hizo, el
> envío se acepta con 202 y **nunca llega** (`codigoMeta=131047`).
>
> Guía de uso al final: [Enviar OTPs de WhatsApp a mano](#enviar-otps-de-whatsapp-a-mano).

> **Para todo lo de SES, la guía operativa detallada es
> [`CONFIGURACION_SES.md`](./CONFIGURACION_SES.md)**: sandbox, verificación de
> destinatarios, salida a producción, deliverability y permisos. Este documento
> queda como bitácora del estado y del camino de WhatsApp.
>
> **Actualización 2026-08-16 (d) — los tres OTP habilitados en el despliegue.**
> `INTEGRATION_OTP=live` e `INTEGRATION_OTP_EMAIL=live` quedaron en las
> variables de la app de Amplify. El bearer del otp-service dejó de leerse solo
> del entorno: desplegado sale del secret `slt-demo-app-secrets`, clave
> `WHATSAPP_MODULAR_TOKEN` (`obtenerWhatsAppModularToken()`), porque las
> variables de Amplify son visibles con lectura de consola y terminan escritas
> en `.env.production` dentro del artefacto de build.

**Actualización 2026-08-16 (c) — RECORRIDO COMPLETO verificado.** Se recorrió
P0→P9 entero con los tres OTP por canales reales y sin panel; terminó en
`EMITIDO` (propuesta 45020093). Detalle, evidencias y las reglas que
verificó: `docs/ENSAYO_GENERAL_CANALES_REALES.md`.

**Actualización 2026-08-16 (b) — CORREO real FUNCIONANDO.** Identidad
`segurolotengo.py@gmail.com` verificada en SES (us-east-1) y política en
línea `SLTDemoQaSesEnvioOtp` (`ses:SendEmail`) adjunta al usuario
`aab1-demo-qa`. Verificado de punta a punta con el adaptador de producción:
el código se generó en `OtpRepository` (solo el hash en DynamoDB) y se
entregó por SES (`referenciaEnvio: SES-…`). Con `INTEGRATION_OTP_EMAIL=live` y
`OTP_EMAIL_FROM`, P4 manda el OTP a casillas reales. Límite vigente: la cuenta
está en **sandbox de SES**, así que cada destinatario debe estar verificado
como identidad; para el piloto, pedir "production access" (caso de soporte,
~24 h) y migrar a un dominio propio con DKIM — un remitente gmail sin firma
propia puede caer en spam.

**Actualización 2026-08-16 — WhatsApp real FUNCIONANDO.** Fase 0 de Meta
completada (app, número de prueba, token permanente de System User) y el
`otp-service` desplegado 24/7 en la VM de OCI con TLS:
`WHATSAPP_MODULAR_URL=https://wamodular.duckdns.org` (ya apuntado en
`segurolotengo-dev-mensajeria-real`; el bearer va en `.env.local`, nunca en
el repo). ⚠️ **Lo que sigue de este párrafo quedó obsoleto el 2026-08-19: el
servicio pasó a `session_text`. Ver el aviso del encabezado.** El OTP viajaba
con el modo interino `template_header` (plantilla
aprobada `requerimiento` — desajuste de categoría aceptado y documentado por
el dueño en `ESTADO.md` de WhatsApp-Modular: solo número de prueba,
bloqueado con `NODE_ENV=production`, se elimina al aprobarse la plantilla
AUTHENTICATION con la Business Verification). Los destinatarios deben estar
registrados como números de prueba en la app de Meta (máx. 5). La sección
de Meta de abajo queda como referencia histórica; lo aún pendiente:
Business Verification (Bloque 6) y la plantilla definitiva.

Estado original al 2026-08-14. El **código está completo en las dos vías** (rama
`feat/otp-whatsapp-modular`): con los flags activados, el demo envía los OTP a
destinatarios reales y el flujo se completa **sin el panel de demo**. Lo que
resta son pasos de credenciales/consola que requieren cuentas del dueño
(Meta y administración de AWS) — ninguno toca código.

Decisión registrada en la tabla de integraciones (filas 2, 3 y 4): WhatsApp
por **WhatsApp-Modular** (Meta Cloud API) y correo por **Amazon SES**;
la integración directa con **Infobip queda solo como backup** para pruebas y
producción.

## Flags del demo

| Variable                     | Efecto                                                                                                                                 |
| :--------------------------- | :------------------------------------------------------------------------------------------------------------------------------------- |
| `INTEGRATION_OTP=live`       | OTP de P1 y OTP de la firma simulada salen por el otp-service de WhatsApp-Modular (`WHATSAPP_MODULAR_URL` + `WHATSAPP_MODULAR_TOKEN`). |
| `INTEGRATION_OTP_EMAIL=live` | OTP de P4 sale por Amazon SES (`OTP_EMAIL_FROM` = remitente verificado). Independiente del flag de WhatsApp.                           |

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
   _sandbox_ de SES y solo entrega a direcciones verificadas. Una identidad
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

---

## Enviar OTPs de WhatsApp a mano

`npm run otp:requerimiento` dispara un OTP real por WhatsApp sin levantar la
app ni recorrer P1. Sirve para probar el canal, para preparar una demo y para
diagnosticar cuando "no llega el código".

Reutiliza el **cliente oficial** del adaptador
(`crearClienteWhatsAppModularDesdeEntorno`), así que recorre exactamente el
mismo camino que la app con `INTEGRATION_OTP=live`. Si el script anda, la app
anda; si el script falla, la app iba a fallar igual.

### Antes de usarlo

En `.env.local` (nunca en el repo):

```
WHATSAPP_MODULAR_URL=https://wamodular.duckdns.org
WHATSAPP_MODULAR_TOKEN=<bearer del otp-service>
```

Y el destinatario tiene que estar registrado como número de prueba en la app
de Meta (máximo 5). A cualquier otro número, Meta responde `131030`.

### Números habilitados hoy (21/08/2026)

**Número de origen** —el que Meta presta mientras no haya número propio, y el
que aparece como remitente de todo OTP de prueba—:

```
+1 555 672 2923
```

Es el mismo valor que `WHATSAPP_NUMERO_PRUEBA` en `.claude/launch.json`. **No
es de nadie**: es el número de prueba compartido que asigna Meta a la app de
desarrollador, así que no aplica la regla de no versionar números reales.

**Destinatarios registrados** en la app, los únicos a los que Meta va a
entregar (a cualquier otro, `131030`). Van **enmascarados**, que alcanza para
reconocer cuál es cuál sin versionar el número entero:

| Número | Prefijo |
| :---- | :---- |
| `+591 720…339` | Bolivia |
| `+591 706…250` | Bolivia |
| `+595 991…468` | Paraguay |

Quedan **dos lugares libres** de los cinco.

**El número completo se saca del panel de Meta**, que es la fuente de verdad de
todos modos: esta tabla dice *cuántos hay y de quién es cada uno*, no sirve
para copiar y pegar. Si un destinatario se agrega o se quita allá, acá queda
viejo — ante una duda manda Meta.

### Uso

```bash
npm run otp:requerimiento -- +59XXXXXXXXX
npm run otp:requerimiento -- +59XXXXXXXXX --proposito SIGNATURE_P7A
```

El número va completo y en formato E.164, sacado del panel de Meta: acá va como
marcador de posición por la misma razón que la tabla de arriba va enmascarada.

El script envía, muestra el `otpId` y el destino enmascarado, y espera a que
teclees el código que te llegó al celular para verificarlo. El código **nunca
pasa por el script**: lo lees del teléfono, igual que un usuario real.

### ⚠️ La regla que hace que llegue o no llegue

**El destinatario tiene que haberle escrito al número de prueba.** No es un
detalle operativo, es la condición de entrega.

El `otp-service` está hoy en `WA_OTP_SEND_MODE=session_text`: manda el código
como texto libre, y Meta solo permite texto libre dentro de la **ventana de
servicio de 24 h**, que **abre únicamente un mensaje del usuario hacia el
negocio**. Un mensaje iniciado por nosotros NO la abre.

Forma cómoda de pedirlo: pasarle a cada persona un enlace que abre WhatsApp
con el mensaje ya escrito, para que solo tenga que tocar "enviar".

```
https://wa.me/<NUMERO_DE_PRUEBA_DE_META>?text=hola
```

Un toque y queda habilitada 24 h desde su último mensaje.

Si en algún momento el servicio vuelve a `template_header` +
`WA_TEMPLATE_OTP=requerimiento`, la ventana deja de importar (una plantilla
inicia conversación) pero aparece **otro** límite: `requerimiento` es de
categoría MARKETING y Meta suprime los envíos repetidos al mismo número. Por
eso el script, después de cada envío, pide que la persona **responda "hola"**
antes de permitir el siguiente: la interacción real es lo que evita esa
supresión. Conviene hacerlo en cualquiera de los dos modos.

### Aceptado no es entregado

El 202 y el `wamid` solo dicen que Meta aceptó el envío. La entrega se
confirma en los webhooks del servicio, en la VM:

```bash
ssh -i ~/.ssh/id_ed25519_oci_lab ubuntu@150.136.67.75 \
  'docker logs --since 10m otp-service 2>&1 | grep -E "estado="'
```

El `2>&1` no es opcional: `docker logs` escribe en stderr.

| Lo que ves                    | Qué significa                      | Qué hacer                            |
| :---------------------------- | :--------------------------------- | :----------------------------------- |
| `sent` → `delivered` → `read` | Llegó                              | Nada                                 |
| `failed … codigoMeta=131047`  | Ventana de 24 h cerrada            | Que la persona escriba "hola"        |
| `failed … codigoMeta=131049`  | Supresión de plantilla MARKETING   | Que responda entre envíos            |
| `failed … codigoMeta=131030`  | No está en los 5 números de prueba | Registrarlo en el panel de Meta      |
| Ningún evento                 | El webhook no llegó                | Revisar el servicio y la suscripción |

### Errores del propio servicio (no de Meta)

Son política funcionando, no fallas:

| Código    | Significa                                                |
| :-------- | :------------------------------------------------------- |
| `WM-1020` | Reenvío antes del cooldown de 60 s                       |
| `WM-1050` | Código incorrecto, con intentos restantes                |
| `WM-1060` | Venció, se agotaron los intentos, o el `otpId` no existe |

### Qué no hacer

- **No cambiar el modo de envío del servicio desde acá.** Vive en el `.env` de
  la VM, en el repo `~/WhatsApp-Modular`. Este repo solo consume la API.
- **No usar el laboratorio Evolution** para OTPs: sus reglas de contención lo
  prohíben.
- **No versionar números reales** ni el bearer. El bearer vive en `.env.local` o
  en Secrets Manager, y los números completos en el panel de Meta.

  La tabla de "Números habilitados hoy" **no es una excepción**: va enmascarada
  justamente para respetar esta regla y a la vez responder la pregunta que
  importa —cuántos destinatarios hay y de quién es cada uno—, que era lo que
  obligaba a abrir el panel de Meta cada vez que un OTP de prueba no llegaba.
  El número de origen sí va completo porque es el de prueba **compartido que
  asigna Meta**, no el de una persona.

### Estado de fondo

Todo esto es interino. La plantilla AUTHENTICATION —la categoría correcta
para OTPs, sin ventana ni supresión— exige la **Business Verification** del
portafolio AAB1, que sigue pendiente. Se intentó esquivarla con una plantilla
UTILITY y Meta la rechazó automáticamente (`INCORRECT_CATEGORY`): reconoce el
contenido como autenticación. La bitácora completa está en
`~/WhatsApp-Modular/docs/ESTADO.md`.
