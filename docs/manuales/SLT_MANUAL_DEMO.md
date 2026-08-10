# SLT · Manual de demostración

Manual operativo para la persona que presenta o prueba el demo de SeguroLoTengo. Acá está **qué pantalla mostrar, en qué orden, con qué persona de prueba, qué pasa en cada transición, y cuándo abrir el panel de demo, la consola administrativa y el visor de evidencia**.

> **Jerarquía.** Este manual no define pantallas ni datos: manda `docs/ESPECIFICACION_PANTALLAS.md` para el contenido de cada pantalla y `docs/ESPECIFICACION_DEMO.md` para el catálogo de datos de prueba. Si este manual contradice a alguno de los dos, ganan ellos.

---

## 1. Antes de empezar

1. `npm run typecheck && npm run lint && npm test` en verde.
2. Servidor levantado con `DEMO_MODE=true` (sin ese flag, el panel de demo **no existe en el build**) y, si se va a mostrar la consola, `ADMIN_CONSOLE_ENABLED=true`.
3. Claves a mano: `DEMO_PANEL_KEY` y `ADMIN_CONSOLE_KEY`, ambas en el secret `slt-demo-app-secrets`. Son secretos **distintos**: la clave del panel no abre la consola ni al revés.
4. Verificá que se vea la banda naranja **"ENTORNO DE DEMOSTRACIÓN — INTEGRACIONES SIMULADAS"** arriba de todo. Aparece en todas las pantallas con `DEMO_MODE=true`; si no está, el flag no quedó activo.
5. Expediente reiniciado (botón *Reiniciar expediente* del panel), para arrancar desde cero.
6. Si vas a mostrar tema oscuro, dejalo elegido antes (botón día/noche en la cabecera).

### Las tres pestañas

| Pestaña | URL | Qué es | Cuándo se abre |
| :---- | :---- | :---- | :---- |
| **Flujo** | `/` | Lo que ve el cliente. Es la pestaña protagonista | Siempre visible |
| **Panel de demo** | `/demo-panel` | Reemplaza lo que en producción llega por WhatsApp/correo/Code100: códigos OTP, acto de firma, palancas de fallos, plazo de firma, persona activa, visor de evidencia | Antes de empezar; se vuelve en P1, P4, P8 y al cierre |
| **Consola administrativa** | `/admin-consola` | Herramienta interna de cumplimiento: búsqueda de expedientes, detalle (única vista autorizada de salud/PEP), visor de evidencia y reinicio con justificativo | Solo en los recorridos de excepción y en el cierre |

**Guion de una frase para abrir la presentación:** todo lo que se ve es real —pantallas, reglas, máquina de estados, evidencia en DynamoDB—; lo único simulado son los siete proveedores externos, y por eso existe el panel de demo: es la "bandeja de entrada" de un WhatsApp y un correo que en producción llegarían de verdad.

---

## 2. Recorrido principal — Camino feliz (Mónica, ~10 minutos)

**Persona:** Mónica Mariana Gorena Tapia · celular `981 000 123` · correo `monica.gorena@example.com` · C.I. 9.323.336 · plan CONFÍO+.

Antes de arrancar: en el panel, verificá que la persona activa sea **Camino feliz** y que no quede ninguna falla armada.

| Orden | Pantalla | Qué hacer | Qué PASA al continuar (transición del expediente) | Panel |
| :---- | :---- | :---- | :---- | :---- |
| 1 | **P0** `/` | `VERIFICAR WHATSAPP Y COTIZAR` | Nada todavía: P0 es informativa, no pide datos ni crea expediente | — |
| 2 | **P1** | Tipear `981 000 123`, marcar la autorización, `ENVIAR CÓDIGO` | Se crea el expediente en `INICIADO` y se envía el primer OTP | **Ir al panel**: leer el código de 6 dígitos, volver, verificar → `CANAL_WA_VERIFICADO` |
| 3 | **P2** | Elegir CONFÍO+ | `PLAN_SELECCIONADO` — queda guardado el ID de versión de la oferta y su hash | — |
| 4 | **P3** | `TENGO TODO LISTO` | `AUTORIZADO` — consentimiento versionado con IP, dispositivo y texto íntegro | — |
| 5 | **P4** | Correo `monica.gorena@example.com` | Segundo OTP, **distinto e independiente** del de P1 | **Ir al panel**: código nuevo → `CANAL_EMAIL_VERIFICADO` |
| 6 | **P5** | Capturas simuladas de cédula y selfie; completar país y estado civil | OCR llena los campos con candado (no editables); la edad se calcula de la cédula → `IDENTIDAD_VERIFICADA` | — |
| 7 | **P6** | Datos complementarios + las 8 declaraciones (todas en su respuesta habilitante) | `DECLARACIONES_OK` — el motor de elegibilidad aprobó | — |
| 8 | **P7** | Pagar con QR Bancard | `PAGO_CONFIRMADO` — arranca el plazo de 24 h para firmar; nunca se guarda PAN ni CVV | — |
| 9 | **P8** | Al entrar, el sistema cierra la Solicitud y el FIPF | `PAQUETE_GENERADO` — los dos PDF hasheados (SHA-256) **antes** de habilitar la firma | — |
| 10 | **P8** | `ENVIAR ENLACE SEGURO DE FIRMA` | Code100 simulado manda el enlace al canal elegido | **Ir al panel**: abrir el enlace (tercer OTP), tipear el código y firmar → `FIRMADO`. Solicitud y FIPF se firman **en un solo acto** |
| 11 | **P9** | Resultado final | `EMITIDO` = solicitud aceptada y emisión ordenada; la póliza la emite Alianza a su ritmo (`Solicitud aceptada ✓` / `Póliza en preparación ⋯`). Descargar Solicitud y FIPF firmados | — |

**Cierre del recorrido — visor de evidencia.** Con P9 en pantalla, volvé al panel y bajá hasta **"Visor de evidencia del expediente en curso"**. Es la vista pensada para el área de cumplimiento; señalá en este orden:

1. **Resultado por integración**: cada proveedor con sus llamadas, éxitos y fallos.
2. **Hashes de documentos**: la Solicitud y el FIPF con su SHA-256 al cierre y los hashes firmados, con el mismo correlativo y prefijos distintos.
3. **Cadena de eventos**: cada paso con fecha, hora, IP, dispositivo y sesión — append-only, nada se pisa ni se borra.
4. Que la evidencia **no contiene** códigos OTP, tarjeta, salud ni PEP.

---

## 3. Recorridos de excepción

Reiniciá el expediente desde el panel antes de cada uno, y cambiá la **persona activa** en el panel al empezar.

### 3.1 Bloqueo por PEP → Pantalla A (Ramón, ~4 minutos)

**Persona:** PEP positivo · celular `982 000 456` · correo `ramon.duarte@example.com` · C.I. 3.874.512 · plan CONFÍO TOTAL · beneficiaria designada (cónyuge, 100%).

1. Repetir P0→P5 como en el camino feliz (dos visitas al panel por los OTP).
2. En **P6**, responder la declaración 8 (condición PEP) en **"Sí"**.
3. Al continuar: `DERIVADO_MANUAL` — el sistema se detiene **antes** del pago, genera un número de caso propio (distinto del correlativo de propuesta) y muestra la **Pantalla A**. Señalar: no es un rechazo, es emisión no automática; y el estado es terminal — desde ahí no existe camino a pago, firma ni emisión.
4. **Abrir la consola administrativa** (es su momento): buscar por cédula `3.874.512`, abrir el detalle y mostrar (a) el bloque de declaraciones con la advertencia de que salud/PEP solo se ven acá, (b) el visor de evidencia con la cadena de eventos hasta la derivación, y (c) el badge "Bloquea": mientras este expediente exista sin superar, esa cédula no puede empezar otro registro (se corta en P5).
5. Si querés cerrar el círculo: **Reinicio con justificativo** en la consola. Elegí un justificativo y mostrá que se crea un expediente **nuevo** enlazado al anterior — el viejo no cambia de estado, sigue `DERIVADO_MANUAL` para siempre.

### 3.2 Bloqueo por salud → Pantalla A (Carolina, ~3 minutos)

**Persona:** Salud incompatible · celular `983 000 789` · correo `carolina.ayala@example.com` · C.I. 5.612.908 · plan CONFÍO.

Igual que el anterior, pero en P6 las declaraciones 1, 2 y 3 van en su respuesta incompatible (1 en "No", 2 y 3 en "Sí"). Señalar: el motivo se registra **por número de declaración**, y las respuestas médicas no salen hacia analítica, CRM ni monitoreo — solo la consola las muestra.

### 3.3 Biometría rechazada — se queda en P5 (Julio, ~2 minutos)

**Persona:** Biometría rechazada · celular `984 000 234` · correo `julio.ramirez@example.com`.

**Importante: elegir la persona "Biometría rechazada" en el panel antes de llegar a P5** — el proveedor de identidad simulado responde según la persona activa del panel, no según el número tipeado en P1. En P5 la coincidencia facial no aprueba. Señalar: los campos extraídos de la cédula no se pueden corregir a mano; el único camino es repetir la captura. No hay Pantalla A acá: no es un problema de elegibilidad sino de identidad.

### 3.4 Paga y no firma → Pantalla B (Lucía, ~5 minutos)

**Persona:** Paga y no firma · celular `985 000 567` · correo `lucia.ortiz@example.com` · C.I. 6.155.740 · plan CONFÍO+.

1. **Primero, en el panel: fijar el plazo de firma corto.** El vencimiento se congela al confirmarse el pago, así que hay que elegirlo **antes** de pagar en P7. (Solo se puede acortar, nunca alargar: alargarlo cambiaría una condición ya informada a la persona.)
2. Recorrer P0→P7 y pagar con **QR**.
3. En P8, **no firmar**. Al vencer el plazo, P8 lleva sola a `/solicitud-vencida` (**Pantalla B**): `VENCIDO` → `DEVOLUCION_EN_TRAMITE` al abrirse el trámite.
4. Señalar: los recordatorios a 1, 5 y 12 horas los manda Interseguros a mano (el sistema los genera, no los envía); la devolución va **únicamente al medio de origen** — no hay campo para un tercero.
5. Para cerrar: botón **"Alianza ejecutó la devolución"** del panel → `DEVUELTO`. La devolución es presencial, fuera del flujo digital; el expediente solo la asienta.
6. Opcional: mostrar en la consola que esta cédula también **bloquea** un registro nuevo hasta que se la reinicie con justificativo.

---

## 4. Fallos forzados (opcional, ~1 minuto cada uno)

Las palancas del panel (*Forzar fallos puntuales*) demuestran que el sistema degrada bien. Cada una vale **para un solo intento**: se ve el error una vez y el reintento funciona. Ninguna inventa un camino — cada fallo produce un estado real que rechaza la validación de siempre.

| Palanca | Dónde se ve | Qué señalar |
| :---- | :---- | :---- |
| OTP expirado | P1 o P4 | La vigencia de 5 minutos es real; el reenvío pide un código nuevo |
| Intentos agotados | P1 o P4 | Máximo 3 intentos, contados contra el repositorio real |
| Timeout de Bancard | P7 | El intento es idempotente: reintentar no duplica el cobro |
| Fallo de captura | P8 (tarjeta) | La captura fallida no bloquea la firma, bloquea la emisión |
| Rechazo de Code100 | P8 | El acto de firma queda rechazado; se pide un enlace nuevo |
| Firmar con falla a mitad | Panel, en el acto de firma | La demostración en vivo de la firma atómica: después del corte, las **dos** huellas siguen diciendo "sin firmar" |

---

## 5. Problemas frecuentes

- **El código OTP no aparece en el panel.** Los códigos viven en memoria del proceso que atendió el envío. Recargá el panel; si sigue sin aparecer, repetí el envío.
- **"Esta cédula ya tiene una solicitud en curso" en P5.** Quedó un expediente `DERIVADO_MANUAL` / `VENCIDO` / `DEVOLUCION_EN_TRAMITE` / `DEVUELTO` de una corrida anterior. Se resuelve desde la consola con el reinicio con justificativo (crea un expediente nuevo; el viejo no se toca).
- **El panel no existe (404).** El build se hizo sin `DEMO_MODE=true`. No es un error: con el flag apagado el panel queda fuera del bundle.
- **La persona equivocada en P5.** El OCR responde según la persona activa del panel. Cambiala en el panel y repetí la captura.
- **Quiero arrancar de cero.** *Reiniciar expediente* en el panel borra la cookie del expediente en curso y deja empezar otro.
