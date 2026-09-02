# Contenido de los modales del canvas (`canvas-logica.js` → `docs()`)

Transcripción literal. El canvas rotula cada uno con su `pie` («Texto de muestra…»). En el producto manda `src/domain/textos-aclaraciones.ts`. Los datos de contacto que aparezcan NO se copian al prototipo ni al producto: `[dato oficial pendiente]`.

## `fipf` — Propuesta de Interseguros S.A. + Formulario de Información Previa a la Firma (FIPF)

*PDF* · meta: `'PROP-00018425 · 6 páginas · SHA-256 8f3a…c410'`

- **PRODUCTO PROPUESTO** — Interseguros S.A. propone la contratación del Seguro de Vida Individual Oncológico CONFÍO de Alianza Garantía, plan 
- **INFORMACIÓN PREVIA AL CONTRATO** — Se deja constancia de que el cliente recibió, con anterioridad a la firma, el detalle de coberturas, sumas aseguradas, exclusiones, carencias (180 días para diagnóstico de cáncer, 30 días para renta hospitalaria y 1 día para las demás coberturas), forma de pago del premio y canales de atención.
- **DECLARACIONES DEL CLIENTE** — Estado de salud, antecedentes de rechazo o agravación en otras aseguradoras, enfermedades diagnosticadas y condición de persona expuesta políticamente, respondidas de forma individual antes de recibir esta propuesta, junto con la aceptación expresa de las carencias y del inicio de vigencia, reproducidas íntegramente en el documento firmado.
- **BENEFICIARIOS** — Designación registrada en la propuesta, con nombre, documento, parentesco y domicilio, por el 100% del capital de fallecimiento.
- **FIRMAS** — Cliente: firma electrónica simple autenticada por código de un solo uso. Interseguros S.A. y Alianza Garantía Seguros y Reaseguros S.A.: firma electrónica cualificada.

Pie: Documento generado por SeguroLoTengo.com, canal digital de Interseguros S.A. Verificable en línea con el código QR impreso.

## `cpc` — Certificado de Cobertura Provisional

*PDF* · meta: `'CPC-00018425 · 1 página · firmado por Alianza Garantía'`

- **ALCANCE** — Alianza Garantía deja constancia de la cobertura provisional del plan 
- **CARENCIAS APLICABLES** — Diagnóstico de cáncer: 180 días. Renta hospitalaria: 30 días. Demás coberturas: 1 día. Los plazos se cuentan desde el inicio de vigencia.

Pie: Este certificado pierde vigencia con la emisión de la póliza, que lo reemplaza a todos los efectos.

## `recibo` — Comprobante de pago del premio

*PDF* · meta: `'REC-00018425 · Bancard · ' + this.gs(plan.premio)`

- **OPERACIÓN** — Pago del premio anual del plan 
- **PROCESADOR** — Bancard S.A. SeguroLoTengo e Interseguros no reciben los fondos ni acceden a los datos de la tarjeta.

Pie: La factura electrónica se emite a nombre del pagador y llega al correo verificado dentro de las 48 horas.

## `poliza` — Póliza de Seguro de Vida Individual Oncológico CONFÍO

*PDF* · meta: `'En emisión · el número definitivo llega por correo y WhatsApp'`

- **ESTADO** — La póliza está en proceso de emisión por Alianza Garantía. Mientras tanto, el Certificado de Cobertura Provisional acredita tu cobertura.
- **CONTENIDO** — Condiciones particulares con tus datos, plan, sumas aseguradas y beneficiarios; condiciones generales del producto inscrito SIS-VID-ONC-001/2026; y anexo de coberturas, exclusiones y carencias.

Pie: Vista previa de muestra. El documento definitivo se firma electrónicamente por Alianza Garantía.

## `coberturas` — Coberturas, exclusiones y carencias

*ANEXO* · meta: `'Anexo informativo · plan ' + plan.nombre`

- **COBERTURAS** — Diagnóstico de cáncer: 
- **CARENCIAS** — La carencia es el tiempo que debe transcurrir desde el inicio de vigencia para que una cobertura pueda utilizarse. Diagnóstico de cáncer: 180 días. Renta hospitalaria: 30 días. Demás coberturas: 1 día. El inicio de vigencia ocurre 24 horas después de confirmado el pago.
- **EXCLUSIONES PRINCIPALES** — Enfermedades preexistentes o diagnosticadas antes del inicio de vigencia; cánceres de piel no melanoma y lesiones in situ según definición de la póliza; hechos derivados de participación en actos delictivos; y las demás exclusiones detalladas en las condiciones generales.
- **EDAD Y RENOVACIÓN** — Edad de ingreso de 18 a 64 años. El diagnóstico confirmado de cáncer impide la renovación; la póliza continúa hasta finalizar la vigencia contratada.

Pie: Anexo entregado antes de la contratación, separado de las condiciones generales, conforme al deber de información previa.

## `condiciones` — Condiciones generales del seguro

*PÓLIZA* · meta: `'Producto inscrito SIS-VID-ONC-001/2026 · Res. SS.SG. N° 250/2026'`

- **OBJETO** — Alianza Garantía se obliga a pagar las indemnizaciones previstas ante los eventos cubiertos ocurridos durante la vigencia, contra el pago del premio.
- **PERFECCIONAMIENTO** — El contrato se perfecciona con la aceptación de la propuesta por la aseguradora y el pago del premio. La cobertura inicia 24 horas después de confirmado el pago.
- **DECLARACIÓN DEL RIESGO** — La reticencia o falsedad en las declaraciones de la propuesta sobre el estado de salud y antecedentes puede provocar la nulidad del contrato conforme al Código Civil.
- **PAGO DE SINIESTROS** — Denuncia por los canales de Alianza Garantía o Interseguros, con la documentación médica que acredite el diagnóstico o el evento. Plazos y procedimiento detallados en el articulado.
- **JURISDICCIÓN** — Se aplican la legislación paraguaya y la normativa de la Superintendencia de Seguros del Banco Central del Paraguay.

Pie: Texto de muestra, resumido para la demostración. El articulado completo forma parte de la póliza emitida.

## `tyc` — Términos y condiciones de uso de SeguroLoTengo.com

*LEGAL* · meta: `'Versión 4.0 · vigente desde agosto de 2026'`

- **QUIÉN OPERA EL SITIO** — SeguroLoTengo.com es marca y canal digital de Interseguros S.A. — Corredores de Seguros. Los seguros ofrecidos son emitidos por Alianza Garantía Seguros y Reaseguros S.A.
- **USO PERSONAL** — La contratación es únicamente a nombre propio, con cédula de identidad paraguaya vigente, y requiere ser mayor de 18 años y menor de 65 al momento del ingreso.
- **CANALES VERIFICADOS** — El WhatsApp y el correo declarados se verifican con un código de un solo uso y se utilizan para entregar documentos y notificaciones. Ningún operador solicita ese código por llamada.
- **FIRMA ELECTRÓNICA** — La firma del cliente es electrónica simple autenticada por código de un solo uso. Las firmas de Interseguros y Alianza son cualificadas.
- **PAGOS** — Los pagos se procesan por Bancard a favor de la aseguradora. El portal no almacena datos de tarjetas.

Pie: Texto de muestra para la demostración del flujo.

## `privacidad` — Aviso de privacidad y tratamiento de datos

*LEGAL* · meta: `'Versión 4.0 · responsables: Interseguros S.A. y Alianza Garantía'`

- **DATOS QUE TRATAMOS** — Datos de identificación extraídos de la cédula, imagen facial y prueba de vida, datos de contacto, laborales y de ingresos, declaraciones de salud y condición de persona expuesta políticamente.
- **PARA QUÉ** — Validar identidad, evaluar el riesgo, emitir la póliza, prevenir fraude y cumplir obligaciones de la normativa de seguros y de prevención de lavado de activos y financiamiento del terrorismo.
- **CON QUIÉN SE COMPARTEN** — Con la aseguradora, el proveedor de firma electrónica, el procesador de pagos Bancard y las autoridades que lo requieran conforme a la ley.
- **CONSERVACIÓN Y DERECHOS** — Los datos se conservan por los plazos legales aplicables. Podés solicitar acceso, rectificación o supresión, y revocar los consentimientos opcionales, escribiendo a los canales de Interseguros.

Pie: Texto de muestra para la demostración del flujo.

## `reclamos` — Consultas y reclamos

*LEGAL* · meta: `'Atención de Interseguros S.A. y Alianza Garantía'`

- **PRIMERA INSTANCIA** — Consultas y reclamos por WhatsApp o correo a Interseguros S.A., que acusa recibo y da seguimiento hasta la respuesta.
- **SEGUNDA INSTANCIA** — Reclamos sobre cobertura, siniestros o emisión ante Alianza Garantía Seguros y Reaseguros S.A.
- **ORGANISMO DE CONTROL** — Superintendencia de Seguros del Banco Central del Paraguay.

Pie: Datos de contacto simulados para la demostración.

## `retracto` — Derecho de retracto

*LEGAL* · meta: `'Contratación a distancia'`

- **PLAZO** — Podés dejar sin efecto la contratación dentro de los plazos previstos por la normativa de defensa del consumidor para las operaciones a distancia, siempre que no se haya denunciado un siniestro.
- **CÓMO** — Solicitándolo por tus canales verificados. Se devuelve el premio pagado conforme a la normativa aplicable.

Pie: Texto de muestra para la demostración del flujo.

## `verificacion` — Verificación de documentos

*LEGAL* · meta: `'Huella SHA-256 y código QR'`

- **CÓMO VERIFICAR** — Cada documento emitido lleva impreso un código QR y una huella SHA-256. Escaneando el QR se compara el archivo con el registro y se confirma su integridad y las firmas aplicadas.

Pie: Función simulada en esta demostración.

## `usoDatos` — Qué datos usamos y para qué

*INFORMACIÓN* · meta: `'Antes de empezar · resumen del uso de tus canales y tus datos'`

- **TUS CANALES** — Usamos tu WhatsApp y tu correo para enviarte el código de verificación, el enlace de firma, la póliza, la factura y recordatorios si dejás el proceso por la mitad.
- **QUIÉNES LOS USAN** — Interseguros S.A., como corredor, y Alianza Garantía, como aseguradora, únicamente para esta contratación y su administración posterior.
- **CON QUIÉN NO SE COMPARTEN** — No vendemos, cedemos ni publicamos tu información con fines comerciales. Solo se entrega a los proveedores necesarios del proceso —firma electrónica y procesador de pagos— y a las autoridades cuando la ley lo exige.
- **PUBLICIDAD** — Recibir ofertas de otros seguros es opcional, se pide por separado al final del flujo y podés revocarlo cuando quieras.

Pie: Resumen informativo. El texto completo está en los términos y condiciones y en el aviso de privacidad.

## `cuidado` — Cómo cuidamos tus datos en este paso

*INFORMACIÓN* · meta: `'En el orden en que te los vamos a pedir'`

- **VALIDACIÓN DE TU WHATSAPP** — Antes de guardar nada sensible confirmamos que el número es tuyo con un código de un solo uso que vence en 5 minutos. Nadie de SeguroLoTengo, Interseguros o Alianza te va a pedir ese código por llamada ni por mensaje.
- **TU DOCUMENTO** — Las fotos de la cédula viajan cifradas y se usan solo para leer tus datos y compararlos con tu selfie. No quedan visibles para ningún operador comercial.
- **TU ROSTRO** — La prueba de vida confirma que sos vos quien está contratando y se conserva como respaldo de la firma, no para publicidad ni para ningún otro fin.
- **TUS DATOS LABORALES Y DE SALUD** — Los pide la normativa para evaluar el riesgo y prevenir el lavado de activos. Los ven únicamente Interseguros y Alianza Garantía.
- **NADA SE COMPARTE CON TERCEROS** — No vendemos, cedemos ni publicamos tu información. Solo se entrega a las autoridades cuando la ley lo exige.

Pie: Resumen informativo. El detalle completo está en el aviso de privacidad.

## `resAlianza` — Alianza Garantía Seguros y Reaseguros S.A. — autorización de operación

*RESOLUCIÓN* · meta: `'Res. SS.SG. N° 118/2003 (dato simulado)'`

- **AUTORIZACIÓN** — Entidad aseguradora autorizada a operar en la República del Paraguay por la Superintendencia de Seguros del Banco Central del Paraguay, en los ramos de vida y patrimoniales.
- **PRODUCTO** — Seguro de Vida Individual Oncológico CONFÍO inscrito bajo SIS-VID-ONC-001/2026, Res. SS.SG. N° 250/2026.

Pie: Datos regulatorios simulados para la demostración.

## `resInter` — Interseguros S.A. — matrícula de corredor de seguros

*RESOLUCIÓN* · meta: `'Matrícula CS N° 0142 · Res. SS.SG. N° 072/2019 (dato simulado)'`

- **HABILITACIÓN** — Sociedad corredora de seguros inscrita en el registro de intermediarios de la Superintendencia de Seguros, habilitada para intermediar en la contratación de seguros.
- **REMUNERACIÓN** — La comisión del corredor es pagada por la aseguradora y no representa un costo adicional para el asegurado.

Pie: Datos regulatorios simulados para la demostración.

## `resSlt` — SeguroLoTengo.com — canal digital autorizado

*RESOLUCIÓN* · meta: `'Res. SS.SG. N° 311/2026 (dato simulado)'`

- **NATURALEZA** — SeguroLoTengo.com es marca y canal digital operado por Interseguros S.A. para la comercialización a distancia de seguros masivos, bajo la matrícula del corredor.
- **ALCANCE** — Autorización del uso de medios digitales, firma electrónica y entrega digital de documentos para la contratación a distancia.

Pie: Datos regulatorios simulados para la demostración.
