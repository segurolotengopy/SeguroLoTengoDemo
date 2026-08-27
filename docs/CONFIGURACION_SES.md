# Configuración de Amazon SES para el OTP de correo (P4)

Guía operativa de la única integración de correo del proyecto: el OTP de P4
(ítem 4 de `Tabla de Integraciones externas - Tabla.csv`, decisión 2026-08-14 —
SES como plataforma, Infobip 2FA Email solo backup).

Región: **us-east-1**. Cuenta: **120005938663**.

---

## Lo primero, porque cambia todo lo demás

**El sandbox no es un problema de spam. Es un rechazo.**

Conviene tenerlo claro antes de tocar nada, porque la intuición engaña: uno
asume que "el correo no llegó" significa que quedó filtrado en algún lado. Acá
no. Con la cuenta en sandbox, SES **rechaza la llamada a la API** si el
destinatario no está verificado, y el correo no llega a salir:

```
MessageRejected: Email address is not verified. The following identities
failed the check in region US-EAST-1: destinatario@gmail.com
```

Consecuencia práctica: *"que llegue aunque caiga en spam"* no es una opción
que el sandbox te deje elegir. O el destinatario está verificado, o no hay
envío. Hay exactamente dos caminos, y la sección 2 y la 3 son eso.

Los tres límites del sandbox:

| Límite | Valor |
| :---- | :---- |
| Destinatarios | Solo identidades verificadas |
| Envíos por día | 200 |
| Envíos por segundo | 1 |

---

## 1. Remitente verificado

**Ya está hecho** (2026-08-16): `segurolotengo.py@gmail.com` está verificada
como identidad en us-east-1, y es la que usa `OTP_EMAIL_FROM`.

Si alguna vez hay que rehacerla: consola → **SES → Identities → Create
identity → Email address**, y clic en el enlace que AWS manda a esa casilla. La
identidad queda en `Pending` hasta ese clic.

**Terraform no la gestiona, a propósito.** `infra/ses-correo-otp.tf` construye
el ARN en vez de declarar el recurso, porque `aab1-demo-deployer` no tiene
`ses:CreateEmailIdentity` ni `ses:GetEmailIdentity` — no puede ni crearla ni
importarla. Declararla hacía que cada `apply` intentara **crear** una identidad
que ya existe y cortara a la mitad. El razonamiento completo está en el
encabezado de ese archivo.

---

## 2. Camino corto: verificar a cada destinatario

Es lo que corresponde para la demostración a gerencia. **Dos minutos por
casilla**, y no requiere esperar a AWS.

Por cada persona que vaya a recibir un OTP:

1. Consola → **SES → Identities → Create identity**.
2. Elegir **Email address**, escribir la casilla, **Create identity**.
3. Esa persona recibe un correo de AWS (`no-reply-aws@amazon.com`, asunto
   *Amazon Web Services – Email Address Verification Request*) y **tiene que
   hacer clic en el enlace**. Vence a las 24 horas.
4. En la consola, la identidad pasa de `Pending` a `Verified`.

Por CLI, si preferís (necesita un perfil con permisos de SES — los locales de
mínimo privilegio no los tienen):

```bash
aws sesv2 create-email-identity --email-identity persona@empresa.com --region us-east-1
```

**Avisales antes de que les llegue.** El correo de verificación de AWS parece
phishing si nadie lo espera, y si lo borran hay que empezar de nuevo.

> **Cuidado con el límite de 200 diarios.** Cada reenvío de OTP cuenta. Para
> una demostración sobra, pero si alguien deja un test en bucle se agota.

---

## 3. Camino largo: salir del sandbox

Necesario para el piloto, no para la demostración. Tarda **~24 horas** y lo
resuelve una persona de AWS leyendo lo que escribas, así que la calidad de la
respuesta importa.

Consola → **SES → Account dashboard → Request production access**.

El formulario pide:

| Campo | Qué poner |
| :---- | :---- |
| Mail type | **Transactional** |
| Website URL | La URL de la demo desplegada |
| Use case description | Ver abajo |
| Additional contacts | La casilla que atiende rebotes |

Para la descripción, lo que AWS quiere saber es que no vas a mandar correo no
solicitado y que sabés manejar rebotes. Algo así:

> Portal B2C de contratación de un seguro de vida en Paraguay. El único correo
> que enviamos es un código de verificación de un solo uso (OTP), disparado por
> el propio usuario al ingresar su dirección durante la contratación, con
> vigencia de 5 minutos. No hay listas, ni newsletters, ni envíos masivos: un
> correo por intento de verificación. Volumen estimado: menos de 500 mensajes
> por mes. Las direcciones las tipea el titular en el momento; no compramos ni
> importamos listas. Rebotes y quejas se monitorean por SNS y la dirección se
> da de baja automáticamente.

Si lo rechazan, casi siempre es por no explicar el origen de las direcciones o
por no decir qué hacés con los rebotes. Ampliá esos dos puntos y volvé a pedir.

---

## 4. Deliverability: por qué vas a caer en spam igual

Esto es independiente del sandbox y **no se arregla saliendo de él**.

El `From:` es `segurolotengo.py@gmail.com`. SES firma con DKIM de
`amazonses.com`, pero el dominio del remitente es `gmail.com`, que no
controlás. Entonces:

- **SPF** no alinea: el correo sale de infraestructura de AWS, no de Google.
- **DKIM** no alinea: la firma es de `amazonses.com`, no de `gmail.com`.
- **DMARC** por lo tanto falla la alineación de identificadores.

Desde febrero de 2024 Gmail exige a los remitentes de volumen SPF, DKIM y
DMARC alineados. Un `From:` de gmail.com llegando desde AWS es exactamente el
patrón de una suplantación, así que el filtro hace lo correcto al desconfiar.

**Para la demostración alcanza** —con la casilla verificada el correo entra, y
si cae en Spam se lo saca de ahí— pero decilo antes de la reunión para que
nadie concluya que el sistema no funciona.

**La solución real es un dominio propio**, y conviene encararla junto con el
piloto:

1. SES → Identities → Create identity → **Domain**, p. ej.
   `segurolotengo.com`.
2. Activar **Easy DKIM** (SES genera 3 registros CNAME).
3. Cargar esos CNAME en el DNS del dominio.
4. Agregar SPF: `v=spf1 include:amazonses.com ~all`.
5. Agregar DMARC, empezando permisivo:
   `v=DMARC1; p=none; rua=mailto:dmarc@segurolotengo.com`.
6. Cambiar `OTP_EMAIL_FROM` a `no-reply@segurolotengo.com`
   (`var.otp_email_remitente` en `infra/ses-correo-otp.tf`).

Con eso los tres alinean y el correo deja de ser sospechoso por construcción.

---

## 5. Permisos

Son dos, y se confunden seguido porque son de sujetos distintos.

**Rol de cómputo de Amplify** — el que usa P4 desplegado. Lo gestiona
Terraform (`aws_iam_role_policy.amplify_ses_envio_otp`), acotado a la identidad
del remitente: enviar "desde" cualquier otra falla.

```bash
AWS_PROFILE=aab1-demo-deployer terraform -chdir=infra apply -target=aws_iam_role_policy.amplify_ses_envio_otp
```

**Usuario local `aab1-demo-qa`** — el que usa `npm run dev`. Es un permiso de
*usuario*, no de rol, así que Terraform no lo toca: está en
`infra/iam-policy-qa-reference.json` (Sid `SesEnvioOtpCorreo`) y se aplica a
mano en consola con la cuenta de administración. **Ya está aplicado** como
política en línea `SLTDemoQaSesEnvioOtp`.

---

## 6. Cómo se prueba

Local, con el adaptador de producción:

```bash
npm run dev  # con la config segurolotengo-dev-mensajeria-real
```

Recorré P4 con una casilla **verificada**. Lo que tiene que pasar:

- El código se genera en `OtpRepository` y **solo su hash** llega a DynamoDB
  (regla inviolable #2).
- La respuesta trae `referenciaEnvio: SES-…` y **nunca** el código.
- En canales en vivo el panel de demo no muestra el código: está en la casilla
  de la persona, que es el punto.

Con una casilla **sin verificar** tiene que fallar con `MessageRejected`. Vale
la pena provocarlo una vez: es el error que vas a ver si te olvidás de
verificar a alguien, y conviene reconocerlo.

---

## 7. Estado y pendientes

| Ítem | Estado |
| :---- | :---- |
| Remitente verificado | ✅ `segurolotengo.py@gmail.com` |
| Permiso del usuario local `aab1-demo-qa` | ✅ `SLTDemoQaSesEnvioOtp` |
| Permiso del rol de cómputo de Amplify | ✅ `aab1-demo-ses-envio-otp` (rol de Amplify) |
| Permiso de diagnóstico del deployer | ✅ `SesIdentidadesSltDemo`, aplicado el 21/08/2026 |
| Destinatarios de la demo verificados | ✅ **las cinco identidades** (ver abajo) |
| Salida del sandbox | ⬜ para el piloto |
| Dominio propio con DKIM | ⬜ para el piloto |

Los dos pendientes son del piloto y no corren para la demostración.

### Identidades verificadas

Comprobado el **21/08/2026** con `aws sesv2 get-email-identity` sobre cada una
—`VerificationStatus: SUCCESS` y `VerifiedForSendingStatus: true` en las cinco—:

| Identidad | Para qué |
| :---- | :---- |
| `segurolotengo.py@gmail.com` | remitente (`OTP_EMAIL_FROM`) y destinatario de prueba |
| `alberdi.andres@gmail.com` | casilla personal |
| `andresalberdik@gmail.com` | casilla personal |
| `silsaki@gmail.com` | casilla de prueba |
| `rfernandez@interseguros360.com` | Interseguros |

> La de Interseguros estuvo en **`FAILED`** hasta el 21/08: la verificación se
> había enviado y no se confirmó dentro de la ventana. `FAILED` **no es
> "pendiente"** —SES marca así lo que caducó sin confirmarse— y hay que
> **reenviar** la verificación, no esperar.

**La cuenta sigue en sandbox** (`ProductionAccessEnabled: false`), con cuota de
200 envíos por día. Con las cinco verificadas eso no molesta para la
demostración: el sandbox solo restringe **a quién** se le puede escribir.

### Cómo comprobar el estado sin entrar a la consola

Desde el 21/08/2026 el deployer tiene permisos de lectura de SES:

```bash
AWS_PROFILE=aab1-demo-deployer aws sesv2 get-account --region us-east-1 \
  --query '{sandbox:(!ProductionAccessEnabled),cuota:SendQuota.Max24HourSend,enviados24h:SendQuota.SentLast24Hours}'

AWS_PROFILE=aab1-demo-deployer aws sesv2 get-email-identity --region us-east-1 \
  --email-identity <casilla> --query '[VerificationStatus,VerifiedForSendingStatus]' --output text
```

`SentLast24Hours` sirve de prueba dura cuando alguien reporta que "no llegó el
correo": si está en 0, **no se intentó enviar nada** y el problema no es SES.
