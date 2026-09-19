# **Alianza Garantía — Respuestas sobre SFTP, firma y emisión**

**Destinatario:** Andres Alberdi (SeguroLoTengo · Interseguros · operador tecnológico AAB1)
**Recibido:** 2026-09-18
**Consulta de origen:** `docs/recepcion/2026-09-14-interseguros/BORRADOR_CORREO_ALIANZA.md`
(enviado por Andres el 17-sep-2026, 6 bloques y 24 preguntas numeradas)
**Análisis derivado:** `docs/ANALISIS_RESPUESTAS_ALIANZA.md`
**Original recibido, sin editar:** `docs/Integraciones/Alianza - Respuestas SFTP firma y emision - original 18-sep.txt`

> Este documento **reordena** las respuestas y las separa de la consulta que las
> originó, igual que los de Bancard y Code100. No cambia una palabra de su
> contenido: las citas van entre comillas y respetan la ortografía del original,
> erratas incluidas. Ante cualquier duda sobre lo que dijeron, manda el `.txt`.

**Estado: 17 de 24 preguntas respondidas, 5 diferidas a una sesión conjunta y 2
rechazadas.** Lo que desbloquean: el **esquema de firmantes** (D-42 deja de ser
preliminar) y el **destino del conector** (host y puerto). Lo que sigue
bloqueando el `terraform apply` completo: la **clave de host**, el **usuario** y
los **algoritmos SSH**, los tres diferidos a la sesión conjunta (A2.3, A2.4).

---

## **1. Documentos a firmar**

### **A1.1** — ¿Coinciden con el esquema de firmantes?

> *"Si, el esquema esta correcto."*

Confirma los tres puntos del esquema enviado, que son los de D-42:

1. **El CPC lo genera SeguroLoTengo** con el modelo que aprueba Alianza, después
   de la firma del cliente y con el pago acreditado, y **lo firma Alianza** por
   SFTP.
2. La **Solicitud + FIPF es un solo PDF** con dos firmas: cliente (no
   cualificada, antes del pago) e Interseguros (cualificada, después del pago).
3. **Alianza no firma la propuesta.** Se la mandamos ya firmada, para archivo,
   verificación del FIPF y emisión.

**El modelo de CPC aprobado llegó el mismo 18-sep**, por separado:
`docs/MODELO_CERTIFICADO_COBERTURA_ALIANZA.docx`, analizado en
`docs/ANALISIS_MODELO_CPC_ALIANZA.md`. Es una plantilla en blanco, y abre ocho
valores que solo Alianza puede confirmar.

---

## **2. Conexión y ambiente de pruebas**

### **A2.1** — ¿Habilitan las tres IP de salida?

> *"Si podemos, nos pueden enviar los tres y habilitamos."*

### **A2.2** — Host y puerto del servidor

> *"De nuestro lado usaremos la IP 138.186.63.132 puerto 2222"*

Es una IP pública (no la `10.0.7.101` interna de la captura). Puerto **2222**,
no el 22 por defecto.

### **A2.3** — Clave pública de host y huella

> *"Esto lo vemos en una sesión independiente"*

**No respondida.** Es el dato que falta para crear el conector.

### **A2.4** — Autenticación por clave SSH y algoritmos admitidos

> *"Podemos verlo en conjunto para que sea mas fácil y rápido"*

**No respondida.** Tampoco dieron el **usuario**, que el correo pedía junto con
esto y que hace falta para el secreto.

### **A2.5** — Carpetas dedicadas por tipo y dirección, con `procesados/`

> *"Si se puede es solo cuestión de nombrar carpetas, sin problema se puede hacer."*

Aceptan el esquema, pero **no confirmaron los nombres**: no dijeron qué carpeta
vigila el firmador ni dónde deposita lo firmado.

### **A2.6** — Ambiente de pruebas y certificado de prueba

> *"Si tenemos ambiente de pruebas, pueden enviar hasta un PDF en blanco la idea
> solo es firmar para ver su funcionamiento."*

Confirman el ambiente. **No respondieron si firman las pruebas con un
certificado de prueba** o con la firma cualificada real.

### **A2.7** — Retención de los archivos ya procesados y quién los retira

> *"Esto es necesario? la manipulación de archivos internos es de carácter
> privado.! se resguardan de manera segura en nuestro sistema."*

**Rechazada.**

### **A2.8** — VPN IPsec como alternativa

> *"Podemos iniciar habilitando las IP Públicas mas arriba mencionadas y mas
> adelante habilitar la VPN, esto debido a lanzar el producto y no retrasar la
> implementación"*

Fase 1 por Internet con las tres IP; VPN después.

---

## **3. Firma de los documentos**

### **A3.1** — Tiempo de respuesta y horario

> *"La firma de documentos se realiza 24/7 cada 30 segundos, la emisión de la
> póliza se hace de manera local con el archivo TXT entregado por ustedes. para
> ese caso conversar con emisión sobre si será 24/7 o 5/8 ya que es tarea
> manual."*

**La firma es 24/7. La emisión de la póliza es trabajo manual** y su horario
está sin definir. No dieron un tiempo máximo garantizado, solo el ciclo de 30 s.

### **A3.2** — Procedimiento si el firmador está fuera de servicio

> *"No va a firmar el documento una vez que no revisan en un tiempo estimado de
> 30 segundos se deben comunicar con nosotros."*

**No hay aviso automático.** Detectar la caída y avisar por teléfono es trabajo
nuestro.

### **A3.3** — ¿El firmador ignora los `.tmp` y los `.json`?

> *"favor enviar el documento en PDF para que se firme y se devuelva de la misma
> forma."*

**No respondida, y pide otra cosa: solo el PDF.** No dijeron qué hace su
firmador con un archivo que no sea PDF, ni con uno a medio subir.

### **A3.4** — Formato de firma, visibilidad y sello de tiempo

> *"La firma es visible y válida con su sello de tiempo."*

Firma **visible** y **con sello de tiempo**. No dijeron **PAdES** con esa
palabra, ni si el sello lo emite una autoridad de sellado (TSA) o es la hora del
equipo firmador.

### **A3.5** — Nombre del archivo firmado y aviso de error

> *"No informamos, el documento se firma o no se firma.! si no llega en los 30
> segundos nos informan"*

**No hay archivo de error ni código de error.** Tampoco confirmaron
explícitamente que conserven el nombre.

### **A3.6** — ¿La firma se agrega como actualización incremental?

> *"La firma se agrega sobre el documento original."*

Es compatible con una firma incremental, pero **no lo afirma en esos términos**.
Solo la prueba con un PDF real lo demuestra.

### **A3.7** — Prioridad de los certificados sobre otros archivos

> *"Es una implementación independiente no esta sujeto a otros archivos."*

El firmador no compite con la emisión: son dos caminos separados.

---

## **4. Registro para la emisión (SEBAOT)**

### **A4.1** — Especificación de importación / diccionario de datos

> *"Podes conseguir con sebaot."*

### **A4.2** — Codificación, separador, encabezado, control, fechas y montos

> *"Verificamos con Sebaot"*

### **A4.3** — Periodicidad

> *"Habiamos quedado que se haría un lote diario y emisión lo procesa una vez
> acreditado el pago."*

**Lote diario**, confirmado.

### **A4.6** — Cómo llega ese lote (aviso posterior, 18-sep por la tarde)

Alianza avisó, por fuera de las respuestas numeradas, que **las solicitudes de
emisión llegan por correo**, en los archivos TXT del modelo, y que **las
procesan a mano en SEBAOT**. No van por SFTP y **no hay confirmación
automática**. No saben por cuánto tiempo va a ser así.

Impacto en `PolicyIssuer` y en el canal, con las tres preguntas que abre:
`docs/ANALISIS_RESPUESTAS_ALIANZA.md` §10.

### **A4.4** — Número de póliza

> *"si se mantiene"*

**La póliza conserva el número de nuestra propuesta.** Confirma lo que el
sistema ya hace (`generarNumeroPropuesta`, correlativo acuñado al cerrar el
paquete documental).

### **A4.5** — Qué datos entregar por caso y en qué orden

> *"Vamos a verificar con Emisión y Sebaot"*

**No respondida.** Tampoco se pronunciaron sobre nuestro pedido de **no repetir
las respuestas de salud** en el TXT.

---

## **5. Respuestas de Alianza (acuses y resultados)**

### **A5** — Archivos de respuesta por etapa (5.1 a 5.5)

> *"Por ahora no tenemos esa opción, igual no es prioridad para la
> implementación. Mas adelante lo podemos adecuar."*

**No habrá archivos de respuesta en la fase 1**: ni acuse de recepción, ni
aceptados/rechazados, ni aviso de póliza emitida, ni de póliza entregada.

---

## **6. Pagos y conciliación**

### **A6** — Conciliación y devoluciones

> *"lo de pagos lo vemos en una sesión a parte y involucramos a tesorería y
> finanzas"*

Diferido a una reunión con tesorería y finanzas.

---

## **Resumen de estado**

| Pregunta | Estado |
| :---- | :---- |
| 1.1 esquema de firmantes | ✅ confirmado |
| 2.1 habilitar 3 IP · 2.2 host y puerto · 2.5 carpetas · 2.8 VPN después | ✅ |
| 2.3 clave de host · 2.4 clave SSH, algoritmos y usuario | ⬜ sesión conjunta |
| 2.6 ambiente de pruebas | ✅ · certificado de prueba ⬜ |
| 2.7 retención | ❌ rechazada |
| 3.1 firma 24/7 · 3.7 sin competencia con emisión | ✅ |
| 3.1 horario de emisión · 3.2 aviso de caída · 3.5 aviso de error | ❌ no existe |
| 3.3 `.tmp` y `.json` | ⬜ pidieron "solo PDF" |
| 3.4 sello de tiempo | ✅ · PAdES y TSA ⬜ |
| 3.6 firma incremental | ⬜ hay que probarlo |
| 4.3 lote diario · 4.4 número propio | ✅ |
| 4.1, 4.2, 4.5 formato del TXT | ⬜ SEBAOT |
| 5 archivos de respuesta | ❌ no en fase 1 |
| 6 pagos | ⬜ sesión con tesorería |
