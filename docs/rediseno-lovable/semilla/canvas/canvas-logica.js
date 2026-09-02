
class Component extends DCLogic {
  state = {
    ctaTexto: '',
    screen: 'inicio',
    ocr: 'pendiente',
    nombres: '', apellidos: '', cedula: '', fnac: '',
    sexo: '', nacionalidad: '', paisNac: '', paisRes: '', estadoCivil: '',
    celular: '', correo: '', correo2: '',
    domicilio: '', ciudad: '', laboral: '', actividad: '', profesion: '', empresa: '', ingreso: '', origen: '',
    otpEnviado: false, otpCodigo: '', otpOk: false,
    capFrente: false, capDorso: false, capSelfie: false,
    legal1: false, legal2: false, legal3: false,
    verLegal1: false, verLegal2: false, verLegal3: false, verFooter: false,
    tema: 'dia', verQueEsFipf: false, notaAbierta: '',
    otpVence: 0, otpEnvios: 0, otpVerificando: false,
    plan: 'CONFIO_PLUS',
    decl: { salud: null, antecedentes: null, enfermedades: null, pep: null, carencias: null },
    benef: 'herederos', benefNombre: '', benefParentesco: '', benefCedula: '', benefFnac: '', benefDomicilio: '', benefCelular: '',
    medio: 'qr', ruc: '', qrGenerado: false, qrSegundos: 5, pagado: false, firmado: false,
    tarNum: '', tarVenc: '', tarCvv: '', tarTitular: '', procesandoTarjeta: false, modalPago: '', intentoTarjeta: false,
    optComercial: false,
    tycInicio: false,
    doc: null,
  };

  planes() {
    return [
      { id: 'CONFIO', nombre: 'CONFÍO', premio: 319000, muerte: 3500000, cancer: 50000000, rentaDia: 500000, gastos: 7000000 },
      { id: 'CONFIO_PLUS', nombre: 'CONFÍO+', premio: 522500, muerte: 5000000, cancer: 75000000, rentaDia: 750000, gastos: 10000000 },
      { id: 'CONFIO_TOTAL', nombre: 'CONFÍO TOTAL', premio: 726000, muerte: 7000000, cancer: 100000000, rentaDia: 1000000, gastos: 14000000 },
    ];
  }

  gs(n) { return 'Gs. ' + n.toLocaleString('es-PY').replace(/,/g, '.'); }
  set(k) { return (e) => this.setState({ [k]: e.target.value }); }
  nav(s) { return (e) => { if (e && e.preventDefault) e.preventDefault(); this.setState({ screen: s }); window.scrollTo(0, 0); }; }
  flip(k) { return (e) => { if (e && e.preventDefault) e.preventDefault(); this.setState(st => ({ [k]: !st[k] })); }; }
  abrir(k) { return (e) => { if (e && e.preventDefault) e.preventDefault(); this.setState({ doc: k }); }; }

  docs() {
    const nombre = ((this.state.nombres + ' ' + this.state.apellidos).trim()) || 'Ana María González Ramírez';
    const ced = this.state.cedula || '4.123.456';
    const plan = this.planes().find(p => p.id === this.state.plan);
    return {
      fipf: {
        tipo: 'PDF', titulo: 'Propuesta de Interseguros S.A. + Formulario de Información Previa a la Firma (FIPF)', meta: 'PROP-00018425 · 6 páginas · SHA-256 8f3a…c410',
        secciones: [
          { h: 'DESTINATARIO DE LA PROPUESTA', p: nombre + ' · C.I. ' + ced + ' · domicilio y datos de contacto verificados por código de un solo uso el ' + new Date().toLocaleDateString('es-PY') + '.' },
          { h: 'PRODUCTO PROPUESTO', p: 'Interseguros S.A. propone la contratación del Seguro de Vida Individual Oncológico CONFÍO de Alianza Garantía, plan ' + plan.nombre + '. Premio anual ' + this.gs(plan.premio) + ', IVA incluido. Vigencia anual con renovación sujeta a las condiciones de la póliza.' },
          { h: 'INFORMACIÓN PREVIA AL CONTRATO', p: 'Se deja constancia de que el cliente recibió, con anterioridad a la firma, el detalle de coberturas, sumas aseguradas, exclusiones, carencias (180 días para diagnóstico de cáncer, 30 días para renta hospitalaria y 1 día para las demás coberturas), forma de pago del premio y canales de atención.' },
          { h: 'DECLARACIONES DEL CLIENTE', p: 'Estado de salud, antecedentes de rechazo o agravación en otras aseguradoras, enfermedades diagnosticadas y condición de persona expuesta políticamente, respondidas de forma individual antes de recibir esta propuesta, junto con la aceptación expresa de las carencias y del inicio de vigencia, reproducidas íntegramente en el documento firmado.' },
          { h: 'BENEFICIARIOS', p: 'Designación registrada en la propuesta, con nombre, documento, parentesco y domicilio, por el 100% del capital de fallecimiento.' },
          { h: 'FIRMAS', p: 'Cliente: firma electrónica simple autenticada por código de un solo uso. Interseguros S.A. y Alianza Garantía Seguros y Reaseguros S.A.: firma electrónica cualificada.' },
        ],
        pie: 'Documento generado por SeguroLoTengo.com, canal digital de Interseguros S.A. Verificable en línea con el código QR impreso.',
      },
      cpc: {
        tipo: 'PDF', titulo: 'Certificado de Cobertura Provisional', meta: 'CPC-00018425 · 1 página · firmado por Alianza Garantía',
        secciones: [
          { h: 'ASEGURADO', p: nombre + ' · C.I. ' + ced + '.' },
          { h: 'ALCANCE', p: 'Alianza Garantía deja constancia de la cobertura provisional del plan ' + plan.nombre + ' del Seguro de Vida Individual Oncológico CONFÍO, a partir de las 24 horas de confirmado el pago del premio y hasta la emisión de la póliza definitiva.' },
          { h: 'CARENCIAS APLICABLES', p: 'Diagnóstico de cáncer: 180 días. Renta hospitalaria: 30 días. Demás coberturas: 1 día. Los plazos se cuentan desde el inicio de vigencia.' },
        ],
        pie: 'Este certificado pierde vigencia con la emisión de la póliza, que lo reemplaza a todos los efectos.',
      },
      recibo: {
        tipo: 'PDF', titulo: 'Comprobante de pago del premio', meta: 'REC-00018425 · Bancard · ' + this.gs(plan.premio),
        secciones: [
          { h: 'OPERACIÓN', p: 'Pago del premio anual del plan ' + plan.nombre + ' por ' + this.gs(plan.premio) + ', IVA incluido, acreditado directamente a favor de Alianza Garantía Seguros y Reaseguros S.A.' },
          { h: 'PAGADOR', p: nombre + ' · documento ' + ced + '.' },
          { h: 'PROCESADOR', p: 'Bancard S.A. SeguroLoTengo e Interseguros no reciben los fondos ni acceden a los datos de la tarjeta.' },
        ],
        pie: 'La factura electrónica se emite a nombre del pagador y llega al correo verificado dentro de las 48 horas.',
      },
      poliza: {
        tipo: 'PDF', titulo: 'Póliza de Seguro de Vida Individual Oncológico CONFÍO', meta: 'En emisión · el número definitivo llega por correo y WhatsApp',
        secciones: [
          { h: 'ESTADO', p: 'La póliza está en proceso de emisión por Alianza Garantía. Mientras tanto, el Certificado de Cobertura Provisional acredita tu cobertura.' },
          { h: 'CONTENIDO', p: 'Condiciones particulares con tus datos, plan, sumas aseguradas y beneficiarios; condiciones generales del producto inscrito SIS-VID-ONC-001/2026; y anexo de coberturas, exclusiones y carencias.' },
        ],
        pie: 'Vista previa de muestra. El documento definitivo se firma electrónicamente por Alianza Garantía.',
      },
      coberturas: {
        tipo: 'ANEXO', titulo: 'Coberturas, exclusiones y carencias', meta: 'Anexo informativo · plan ' + plan.nombre,
        secciones: [
          { h: 'COBERTURAS', p: 'Diagnóstico de cáncer: ' + this.gs(plan.cancer) + ' en un pago único. Fallecimiento por cualquier causa: ' + this.gs(plan.muerte) + '. Renta hospitalaria: ' + this.gs(plan.rentaDia) + ' por día, hasta 15 días por año. Gastos médicos por accidente: hasta ' + this.gs(plan.gastos) + ' por reembolso.' },
          { h: 'CARENCIAS', p: 'La carencia es el tiempo que debe transcurrir desde el inicio de vigencia para que una cobertura pueda utilizarse. Diagnóstico de cáncer: 180 días. Renta hospitalaria: 30 días. Demás coberturas: 1 día. El inicio de vigencia ocurre 24 horas después de confirmado el pago.' },
          { h: 'EXCLUSIONES PRINCIPALES', p: 'Enfermedades preexistentes o diagnosticadas antes del inicio de vigencia; cánceres de piel no melanoma y lesiones in situ según definición de la póliza; hechos derivados de participación en actos delictivos; y las demás exclusiones detalladas en las condiciones generales.' },
          { h: 'EDAD Y RENOVACIÓN', p: 'Edad de ingreso de 18 a 64 años. El diagnóstico confirmado de cáncer impide la renovación; la póliza continúa hasta finalizar la vigencia contratada.' },
        ],
        pie: 'Anexo entregado antes de la contratación, separado de las condiciones generales, conforme al deber de información previa.',
      },
      condiciones: {
        tipo: 'PÓLIZA', titulo: 'Condiciones generales del seguro', meta: 'Producto inscrito SIS-VID-ONC-001/2026 · Res. SS.SG. N° 250/2026',
        secciones: [
          { h: 'OBJETO', p: 'Alianza Garantía se obliga a pagar las indemnizaciones previstas ante los eventos cubiertos ocurridos durante la vigencia, contra el pago del premio.' },
          { h: 'PERFECCIONAMIENTO', p: 'El contrato se perfecciona con la aceptación de la propuesta por la aseguradora y el pago del premio. La cobertura inicia 24 horas después de confirmado el pago.' },
          { h: 'DECLARACIÓN DEL RIESGO', p: 'La reticencia o falsedad en las declaraciones de la propuesta sobre el estado de salud y antecedentes puede provocar la nulidad del contrato conforme al Código Civil.' },
          { h: 'PAGO DE SINIESTROS', p: 'Denuncia por los canales de Alianza Garantía o Interseguros, con la documentación médica que acredite el diagnóstico o el evento. Plazos y procedimiento detallados en el articulado.' },
          { h: 'JURISDICCIÓN', p: 'Se aplican la legislación paraguaya y la normativa de la Superintendencia de Seguros del Banco Central del Paraguay.' },
        ],
        pie: 'Texto de muestra, resumido para la demostración. El articulado completo forma parte de la póliza emitida.',
      },
      tyc: {
        tipo: 'LEGAL', titulo: 'Términos y condiciones de uso de SeguroLoTengo.com', meta: 'Versión 4.0 · vigente desde agosto de 2026',
        secciones: [
          { h: 'QUIÉN OPERA EL SITIO', p: 'SeguroLoTengo.com es marca y canal digital de Interseguros S.A. — Corredores de Seguros. Los seguros ofrecidos son emitidos por Alianza Garantía Seguros y Reaseguros S.A.' },
          { h: 'USO PERSONAL', p: 'La contratación es únicamente a nombre propio, con cédula de identidad paraguaya vigente, y requiere ser mayor de 18 años y menor de 65 al momento del ingreso.' },
          { h: 'CANALES VERIFICADOS', p: 'El WhatsApp y el correo declarados se verifican con un código de un solo uso y se utilizan para entregar documentos y notificaciones. Ningún operador solicita ese código por llamada.' },
          { h: 'FIRMA ELECTRÓNICA', p: 'La firma del cliente es electrónica simple autenticada por código de un solo uso. Las firmas de Interseguros y Alianza son cualificadas.' },
          { h: 'PAGOS', p: 'Los pagos se procesan por Bancard a favor de la aseguradora. El portal no almacena datos de tarjetas.' },
        ],
        pie: 'Texto de muestra para la demostración del flujo.',
      },
      privacidad: {
        tipo: 'LEGAL', titulo: 'Aviso de privacidad y tratamiento de datos', meta: 'Versión 4.0 · responsables: Interseguros S.A. y Alianza Garantía',
        secciones: [
          { h: 'DATOS QUE TRATAMOS', p: 'Datos de identificación extraídos de la cédula, imagen facial y prueba de vida, datos de contacto, laborales y de ingresos, declaraciones de salud y condición de persona expuesta políticamente.' },
          { h: 'PARA QUÉ', p: 'Validar identidad, evaluar el riesgo, emitir la póliza, prevenir fraude y cumplir obligaciones de la normativa de seguros y de prevención de lavado de activos y financiamiento del terrorismo.' },
          { h: 'CON QUIÉN SE COMPARTEN', p: 'Con la aseguradora, el proveedor de firma electrónica, el procesador de pagos Bancard y las autoridades que lo requieran conforme a la ley.' },
          { h: 'CONSERVACIÓN Y DERECHOS', p: 'Los datos se conservan por los plazos legales aplicables. Podés solicitar acceso, rectificación o supresión, y revocar los consentimientos opcionales, escribiendo a los canales de Interseguros.' },
        ],
        pie: 'Texto de muestra para la demostración del flujo.',
      },
      reclamos: {
        tipo: 'LEGAL', titulo: 'Consultas y reclamos', meta: 'Atención de Interseguros S.A. y Alianza Garantía',
        secciones: [
          { h: 'PRIMERA INSTANCIA', p: 'Consultas y reclamos por WhatsApp o correo a Interseguros S.A., que acusa recibo y da seguimiento hasta la respuesta.' },
          { h: 'SEGUNDA INSTANCIA', p: 'Reclamos sobre cobertura, siniestros o emisión ante Alianza Garantía Seguros y Reaseguros S.A.' },
          { h: 'ORGANISMO DE CONTROL', p: 'Superintendencia de Seguros del Banco Central del Paraguay.' },
        ],
        pie: 'Datos de contacto simulados para la demostración.',
      },
      retracto: {
        tipo: 'LEGAL', titulo: 'Derecho de retracto', meta: 'Contratación a distancia',
        secciones: [
          { h: 'PLAZO', p: 'Podés dejar sin efecto la contratación dentro de los plazos previstos por la normativa de defensa del consumidor para las operaciones a distancia, siempre que no se haya denunciado un siniestro.' },
          { h: 'CÓMO', p: 'Solicitándolo por tus canales verificados. Se devuelve el premio pagado conforme a la normativa aplicable.' },
        ],
        pie: 'Texto de muestra para la demostración del flujo.',
      },
      verificacion: {
        tipo: 'LEGAL', titulo: 'Verificación de documentos', meta: 'Huella SHA-256 y código QR',
        secciones: [
          { h: 'CÓMO VERIFICAR', p: 'Cada documento emitido lleva impreso un código QR y una huella SHA-256. Escaneando el QR se compara el archivo con el registro y se confirma su integridad y las firmas aplicadas.' },
        ],
        pie: 'Función simulada en esta demostración.',
      },
      usoDatos: {
        tipo: 'INFORMACIÓN', titulo: 'Qué datos usamos y para qué', meta: 'Antes de empezar · resumen del uso de tus canales y tus datos',
        secciones: [
          { h: 'TUS CANALES', p: 'Usamos tu WhatsApp y tu correo para enviarte el código de verificación, el enlace de firma, la póliza, la factura y recordatorios si dejás el proceso por la mitad.' },
          { h: 'QUIÉNES LOS USAN', p: 'Interseguros S.A., como corredor, y Alianza Garantía, como aseguradora, únicamente para esta contratación y su administración posterior.' },
          { h: 'CON QUIÉN NO SE COMPARTEN', p: 'No vendemos, cedemos ni publicamos tu información con fines comerciales. Solo se entrega a los proveedores necesarios del proceso —firma electrónica y procesador de pagos— y a las autoridades cuando la ley lo exige.' },
          { h: 'PUBLICIDAD', p: 'Recibir ofertas de otros seguros es opcional, se pide por separado al final del flujo y podés revocarlo cuando quieras.' },
        ],
        pie: 'Resumen informativo. El texto completo está en los términos y condiciones y en el aviso de privacidad.',
      },
      cuidado: {
        tipo: 'INFORMACIÓN', titulo: 'Cómo cuidamos tus datos en este paso', meta: 'En el orden en que te los vamos a pedir',
        secciones: [
          { h: 'VALIDACIÓN DE TU WHATSAPP', p: 'Antes de guardar nada sensible confirmamos que el número es tuyo con un código de un solo uso que vence en 5 minutos. Nadie de SeguroLoTengo, Interseguros o Alianza te va a pedir ese código por llamada ni por mensaje.' },
          { h: 'TU DOCUMENTO', p: 'Las fotos de la cédula viajan cifradas y se usan solo para leer tus datos y compararlos con tu selfie. No quedan visibles para ningún operador comercial.' },
          { h: 'TU ROSTRO', p: 'La prueba de vida confirma que sos vos quien está contratando y se conserva como respaldo de la firma, no para publicidad ni para ningún otro fin.' },
          { h: 'TUS DATOS LABORALES Y DE SALUD', p: 'Los pide la normativa para evaluar el riesgo y prevenir el lavado de activos. Los ven únicamente Interseguros y Alianza Garantía.' },
          { h: 'NADA SE COMPARTE CON TERCEROS', p: 'No vendemos, cedemos ni publicamos tu información. Solo se entrega a las autoridades cuando la ley lo exige.' },
        ],
        pie: 'Resumen informativo. El detalle completo está en el aviso de privacidad.',
      },
      sitioAlianza: {
        tipo: 'SITIO WEB', titulo: 'Alianza Garantía Seguros y Reaseguros S.A.', meta: 'https://alianzagarantia.com/#/home · vista simulada', sitio: true,
        secciones: [
          { h: 'LA ASEGURADORA', p: 'Compañía de seguros autorizada a operar en la República del Paraguay por la Superintendencia de Seguros del Banco Central del Paraguay, en ramos de vida y patrimoniales.' },
          { h: 'AUTORIZACIÓN', p: 'Res. SS.SG. N° 118/2003. Producto de este flujo: Seguro de Vida Individual Oncológico CONFÍO, inscrito bajo SIS-VID-ONC-001/2026, Res. SS.SG. N° 250/2026.' },
          { h: 'CONTACTO', p: 'Emisión, cobertura y reclamos: +595 21 000 000 · atencion@alianza.com.py' },
        ],
        pie: 'Vista simulada del sitio institucional. Datos de contacto y resoluciones de demostración.',
      },
      sitioInter: {
        tipo: 'SITIO WEB', titulo: 'Interseguros S.A. · Corredores de Seguros', meta: 'https://interseguros360.com/ · vista simulada', sitio: true,
        secciones: [
          { h: 'EL CORREDOR', p: 'Sociedad corredora de seguros inscrita en el registro de intermediarios de la Superintendencia de Seguros, habilitada para intermediar en la contratación de seguros.' },
          { h: 'AUTORIZACIÓN', p: 'Matrícula CS N° 0142 · Res. SS.SG. N° 072/2019. La comisión del corredor la paga la aseguradora y no representa un costo adicional para el asegurado.' },
          { h: 'CONTACTO', p: 'Asistencia y seguimiento: +595 21 000 001 · hola@interseguros.com.py' },
        ],
        pie: 'Vista simulada del sitio institucional. Datos de contacto y resoluciones de demostración.',
      },
      sitioSlt: {
        tipo: 'SITIO WEB', titulo: 'SeguroLoTengo.com', meta: 'https://www.segurolotengo.com · vista simulada', sitio: true,
        secciones: [
          { h: 'EL CANAL DIGITAL', p: 'Marca y canal digital operado por Interseguros S.A. para la comercialización a distancia de seguros masivos, bajo la matrícula del corredor.' },
          { h: 'AUTORIZACIÓN', p: 'Res. SS.SG. N° 311/2026, que habilita el uso de medios digitales, firma electrónica y entrega digital de documentos para la contratación a distancia.' },
          { h: 'QUÉ ENCONTRÁS ACÁ', p: 'Contratación en tres pasos desde el celular, descarga de tus documentos firmados y verificación de autenticidad por código QR.' },
        ],
        pie: 'Vista simulada del sitio. Datos regulatorios de demostración.',
      },
      resAlianza: {
        tipo: 'RESOLUCIÓN', titulo: 'Alianza Garantía Seguros y Reaseguros S.A. — autorización de operación', meta: 'Res. SS.SG. N° 118/2003 (dato simulado)',
        secciones: [
          { h: 'AUTORIZACIÓN', p: 'Entidad aseguradora autorizada a operar en la República del Paraguay por la Superintendencia de Seguros del Banco Central del Paraguay, en los ramos de vida y patrimoniales.' },
          { h: 'PRODUCTO', p: 'Seguro de Vida Individual Oncológico CONFÍO inscrito bajo SIS-VID-ONC-001/2026, Res. SS.SG. N° 250/2026.' },
        ],
        pie: 'Datos regulatorios simulados para la demostración.',
      },
      resInter: {
        tipo: 'RESOLUCIÓN', titulo: 'Interseguros S.A. — matrícula de corredor de seguros', meta: 'Matrícula CS N° 0142 · Res. SS.SG. N° 072/2019 (dato simulado)',
        secciones: [
          { h: 'HABILITACIÓN', p: 'Sociedad corredora de seguros inscrita en el registro de intermediarios de la Superintendencia de Seguros, habilitada para intermediar en la contratación de seguros.' },
          { h: 'REMUNERACIÓN', p: 'La comisión del corredor es pagada por la aseguradora y no representa un costo adicional para el asegurado.' },
        ],
        pie: 'Datos regulatorios simulados para la demostración.',
      },
      resSlt: {
        tipo: 'RESOLUCIÓN', titulo: 'SeguroLoTengo.com — canal digital autorizado', meta: 'Res. SS.SG. N° 311/2026 (dato simulado)',
        secciones: [
          { h: 'NATURALEZA', p: 'SeguroLoTengo.com es marca y canal digital operado por Interseguros S.A. para la comercialización a distancia de seguros masivos, bajo la matrícula del corredor.' },
          { h: 'ALCANCE', p: 'Autorización del uso de medios digitales, firma electrónica y entrega digital de documentos para la contratación a distancia.' },
        ],
        pie: 'Datos regulatorios simulados para la demostración.',
      },
    };
  }

  componentWillUnmount() { if (this._tQr) clearInterval(this._tQr); if (this._tOtp) clearInterval(this._tOtp); if (this._tFoto) clearInterval(this._tFoto); if (this._tTar) clearTimeout(this._tTar);
    if (this._tCta) clearInterval(this._tCta);
    if (this._verCta) { window.removeEventListener('scroll', this._verCta, true); window.removeEventListener('resize', this._verCta); } }

  componentDidMount() {
    if (super.componentDidMount) super.componentDidMount();
    this._tFoto = setInterval(() => this.setState(s => ({ foto: ((s.foto || 0) + 1) % 4 })), 4500);
    this._verCta = () => {
      const nodos = Array.from(document.querySelectorAll('[data-cta]')).filter(n => !n.disabled && n.offsetParent);
      const objetivo = nodos.find(n => n.getBoundingClientRect().top > window.innerHeight - 76);
      this._ctaNodo = objetivo || null;
      const texto = objetivo ? objetivo.getAttribute('data-cta') : '';
      if (texto !== this.state.ctaTexto) this.setState({ ctaTexto: texto });
    };
    this._tCta = setInterval(this._verCta, 400);
    window.addEventListener('scroll', this._verCta, true);
    window.addEventListener('resize', this._verCta);
  }

  verFoto(i) { this.setState({ foto: i }); if (this._tFoto) clearInterval(this._tFoto); this._tFoto = setInterval(() => this.setState(s => ({ foto: ((s.foto || 0) + 1) % 4 })), 4500); }

  renderVals() {
    const s = this.state;
    const fi = s.foto || 0;
    const vals = {
      opFoto1: fi === 0 ? 1 : 0, opFoto2: fi === 1 ? 1 : 0, opFoto3: fi === 2 ? 1 : 0, opFoto4: fi === 3 ? 1 : 0,
      dotFoto1: fi === 0 ? 'var(--color-accent)' : 'var(--color-neutral-400)',
      dotFoto2: fi === 1 ? 'var(--color-accent)' : 'var(--color-neutral-400)',
      dotFoto3: fi === 2 ? 'var(--color-accent)' : 'var(--color-neutral-400)',
      dotFoto4: fi === 3 ? 'var(--color-accent)' : 'var(--color-neutral-400)',
      verFoto1: () => this.verFoto(0), verFoto2: () => this.verFoto(1), verFoto3: () => this.verFoto(2), verFoto4: () => this.verFoto(3),
    };

    const modoDemoOn = this.props.modoDemo ?? true;
    const nombreCompleto = (s.nombres + ' ' + s.apellidos).trim();
    const nombrePila = (s.nombres.trim().split(/\s+/)[0] || '').replace(/^./, c => c.toUpperCase());
    const con = (frase) => nombrePila ? `${nombrePila}, ${frase}` : frase.replace(/^./, c => c.toUpperCase());

    const mask = (tel) => {
      const d = tel.replace(/\D/g, '');
      return d.length >= 6 ? `+595 ••• ••• ${d.slice(-3)}` : '+595 ••• ••• •••';
    };
    const maskMail = (m) => {
      const [u, dom] = m.split('@');
      return dom ? `${u.slice(0, 2)}•••@${dom}` : '•••';
    };

    const capsOk = s.capFrente && s.capDorso && s.capSelfie;
    const correoNoCoincide = s.correo2.length > 3 && s.correo !== s.correo2;
    const correoOk = s.correo.includes('@') && s.correo === s.correo2;

    const identidadOk = s.nombres.trim().length > 1 && s.apellidos.trim().length > 1 && s.sexo && s.nacionalidad && s.paisNac && s.paisRes && s.estadoCivil;
    const complementariosOk = s.domicilio.trim().length > 3 && s.ciudad && s.laboral && s.actividad && s.profesion && s.empresa.trim().length > 1 && s.ingreso && s.origen;

    const req = (ok) => ok ? '' : 'border:2px solid var(--color-accent);background:var(--color-accent-100);';
    const irAlPrimerFaltante = () => {
      const modal = document.querySelector('[data-modal-pago]');
      const raiz = modal || document;
      const el = raiz.querySelector('.input[style*="accent-100"], [data-falta="1"], [data-pendiente="1"]');
      if (!el) return;
      const caja = modal || document.scrollingElement || document.documentElement;
      const alto = modal ? modal.clientHeight : window.innerHeight;
      const rel = el.getBoundingClientRect().top - caja.getBoundingClientRect().top + caja.scrollTop;
      caja.scrollTo({ top: Math.max(0, rel - Math.round(alto * 0.3)), behavior: 'smooth' });
      el.classList.add('pulso');
      setTimeout(() => el.classList.remove('pulso'), 1500);
      const foco = el.matches('input, select, textarea') ? el : el.querySelector('input, select, textarea');
      if (foco) setTimeout(() => { try { foco.focus({ preventScroll: true }); } catch (e) { foco.focus(); } }, 420);
    };
    const seguirO = (incompleto, destino) => () => {
      if (incompleto) { irAlPrimerFaltante(); return; }
      this.nav(destino)();
    };

    const falta1Items = [];
    if (s.ocr !== 'listo') falta1Items.push('leer los datos de tu cédula');
    if (!identidadOk) falta1Items.push('confirmar tus datos de identidad');
    if (!correoOk) falta1Items.push('declarar tu correo dos veces (iguales)');
    if (!s.otpOk) falta1Items.push('verificar tu WhatsApp con el código');
    if (!complementariosOk) falta1Items.push('completar tus datos complementarios');
    if (!s.legal1) falta1Items.push('marcar la aceptación de abajo');
    const paso1Incompleto = falta1Items.length > 0;

    const capturas = [
      { id: 'capFrente', rotulo: 'Cédula · frente', detalle: 'Documento completo, enfocado y sin reflejos.', accion: 'Tocá acá para fotografiar el frente' },
      { id: 'capDorso', rotulo: 'Cédula · dorso', detalle: 'Documento completo, enfocado y legible.', accion: 'Tocá acá para fotografiar el dorso' },
      { id: 'capSelfie', rotulo: 'Selfie en vivo', detalle: 'Seguí los movimientos de la prueba de vida.', accion: 'Tocá acá para iniciar la verificación' },
    ].map(c => ({ ...c, ok: s[c.id], pendiente: !s[c.id], esFrente: c.id === 'capFrente', esDorso: c.id === 'capDorso', esSelfie: c.id === 'capSelfie', capturar: () => this.setState({ [c.id]: true }) }));

    const leerDocumento = () => {
      this.setState({ ocr: 'procesando' });
      setTimeout(() => this.setState({
        ocr: 'listo',
        nombres: 'Ana María', apellidos: 'González Ramírez',
        cedula: '4.123.456', fnac: '14/03/1989',
        sexo: 'Femenino', nacionalidad: 'Paraguaya', paisNac: 'Paraguay', paisRes: 'Paraguay', estadoCivil: 'Soltera/o',
      }), 1400);
    };

    const ramos = [
      { id: 'onco', rotulo: 'ONCOLÓGICO', activo: true },
      { id: 'vida', rotulo: 'VIDA', activo: false },
      { id: 'accidentes', rotulo: 'ACCIDENTES PERSONALES', activo: false },
      { id: 'rc', rotulo: 'RESPONSABILIDAD CIVIL', activo: false },
    ].map(r => ({
      rotulo: r.rotulo,
      proximo: !r.activo,
      elegir: () => {},
      estilo: `flex:none;border:none;background:none;cursor:${r.activo ? 'default' : 'not-allowed'};padding:12px 18px 11px;font-family:var(--font-body);font-size:12.5px;font-weight:${r.activo ? '700' : '500'};letter-spacing:0.06em;white-space:nowrap;color:${r.activo ? 'var(--color-accent-700)' : 'var(--color-neutral-400)'};border-bottom:3px solid ${r.activo ? 'var(--color-accent)' : 'transparent'};margin-bottom:-2px;`,
    }));

    const planes = this.planes().map(p => {
      const sel = s.plan === p.id;
      return {
        ...p, sel,
        premioFmt: this.gs(p.premio), muerteFmt: this.gs(p.muerte), cancerFmt: this.gs(p.cancer),
        rentaDiaFmt: this.gs(p.rentaDia), gastosFmt: this.gs(p.gastos),
        estiloTarjeta: `border:1px solid var(--color-divider);border-radius:16px;padding:20px;background:${sel ? 'var(--color-accent-100)' : '#fff'};`,
        claseBoton: sel ? 'btn btn-primary' : 'btn btn-secondary',
        rotuloBoton: sel ? '✓ Plan elegido' : 'Tocá acá para elegir este plan',
        elegir: () => this.setState({ plan: p.id }),
      };
    });
    const plan = this.planes().find(p => p.id === s.plan);
    const primaNeta = Math.round(plan.premio / 1.1);

    const coberturas = [
      { rotulo: 'Diagnóstico de cáncer', monto: this.gs(plan.cancer), detalle: 'Pago único al confirmarse el diagnóstico cubierto. Carencia de 180 días.' },
      { rotulo: 'Fallecimiento', monto: this.gs(plan.muerte), detalle: 'Por cualquier causa, a tus beneficiarios. Carencia de 1 día.' },
      { rotulo: 'Renta hospitalaria', monto: this.gs(plan.rentaDia) + ' por día', detalle: 'Hasta 15 días por año de internación. Carencia de 30 días.' },
      { rotulo: 'Gastos médicos por accidente', monto: 'hasta ' + this.gs(plan.gastos), detalle: 'Reembolso contra comprobantes. Carencia de 1 día.' },
    ];

    const preguntas = [
      { k: 'salud', habilita: true, texto: con('¿te encontrás en buen estado de salud y contratás este seguro sin buscar cubrir una enfermedad o diagnóstico que ya tengas?'), aviso: 'Con esta respuesta tu solicitud pasa a un asesor antes de cualquier pago o firma — te explicamos al final.' },
      { k: 'antecedentes', habilita: false, texto: '¿Alguna aseguradora te rechazó, postergó o condicionó una solicitud de seguro similar?', aviso: 'Con esta respuesta tu solicitud pasa a un asesor antes de cualquier pago o firma.' },
      { k: 'enfermedades', habilita: false, texto: '¿Tenés diagnosticado cáncer, enfermedad cardiovascular, insuficiencia renal, diabetes, esclerosis, enfermedad autoinmune o inmunodeficiente, hepatitis o cirrosis?', aviso: 'Con esta respuesta tu solicitud pasa a un asesor antes de cualquier pago o firma.' },
      { k: 'pep', habilita: false, texto: con('¿sos una persona expuesta políticamente o estás vinculada a una?'), rotuloNota: '¿Qué significa PEP?', nota: 'PEP es Persona Expuesta Políticamente: quien ocupa u ocupó en los últimos años un cargo público relevante —electivo, de gobierno, judicial, militar o en empresas del Estado y organismos internacionales—, y también sus familiares cercanos y sus asociados. Es una pregunta obligatoria de la normativa de prevención de lavado de activos: responder Sí no impide contratar, solo requiere el análisis de un asesor.', aviso: 'La condición PEP requiere el análisis de un asesor antes de cualquier pago o firma.' },
      { k: 'carencias', habilita: true, bloqueante: true, texto: '¿Entendés y aceptás las carencias y el inicio de vigencia? Son los plazos que tienen que pasar antes de poder usar cada cobertura: 180 días para el diagnóstico de cáncer, 30 días para la renta hospitalaria y 1 día para el resto, contados desde que arranca tu cobertura, 24 horas después de confirmado el pago.', rotuloNota: 'Ver el detalle completo', nota: 'Si el diagnóstico o la internación ocurren dentro de esos plazos, no corresponde indemnización. Los plazos se cuentan desde el inicio de vigencia —es decir, desde las 24 horas posteriores a la confirmación del pago— y no desde hoy. Tampoco se cubren las enfermedades preexistentes ni las diagnosticadas antes del inicio de vigencia. Esta aceptación queda registrada en tu propuesta y en el FIPF como constancia de que conocías las carencias antes de contratar.', aviso: 'Sin esta aceptación no podemos avanzar: es la constancia de que conocés las carencias antes de contratar. Si algo no te queda claro, un asesor te lo explica.' },
    ];
    const declaraciones = preguntas.map(p => {
      const r = s.decl[p.k];
      const incompatible = r !== null && r !== p.habilita;
      const destacar = false;
      const base = 'btn btn-ghost'; const on = 'btn btn-primary';
      return {
        texto: p.texto, aviso: p.aviso, avisar: incompatible,
        nota: p.nota || '', tieneNota: !!p.nota,
        notaVisible: s.notaAbierta === p.k,
        rotuloNota: s.notaAbierta === p.k ? 'Ocultar' : (p.rotuloNota || 'Saber más'),
        alternarNota: (e) => { if (e && e.preventDefault) e.preventDefault(); this.setState(st => ({ notaAbierta: st.notaAbierta === p.k ? '' : p.k })); },
        estilo: `border:${destacar ? '2px solid var(--color-accent-600)' : '1px solid var(--color-divider)'};border-radius:12px;background:var(--sup);padding:${destacar ? '16px 18px' : '14px 16px'};`,
        rotulo: destacar ? 'ACEPTACIÓN DE CARENCIAS E INICIO DE VIGENCIA' : '',
        conRotulo: destacar,
        falta: (r === null || (p.bloqueante && r !== p.habilita)) ? '1' : '',
        claseSi: r === true ? on : base, claseNo: r === false ? on : base,
        responderSi: () => this.setState(st => ({ decl: { ...st.decl, [p.k]: true } })),
        responderNo: () => this.setState(st => ({ decl: { ...st.decl, [p.k]: false } })),
      };
    });
    const respondidas = preguntas.every(p => s.decl[p.k] !== null);
    const hayIncompatibles = preguntas.some(p => !p.bloqueante && s.decl[p.k] !== null && s.decl[p.k] !== p.habilita);
    const carenciasRechazadas = s.decl.carencias === false;
    const benefOk = s.benef === 'herederos' || (s.benefNombre.trim().length > 1 && s.benefParentesco && s.benefCedula.trim().length > 3 && s.benefDomicilio.trim().length > 5 && s.benefFnac.trim().length > 5 && s.benefCelular.replace(/\D/g, '').length >= 6);
    const falta2Items = [];
    if (!respondidas) falta2Items.push('responder las preguntas');
    if (carenciasRechazadas) falta2Items.push('aceptar las carencias y el inicio de vigencia');
    if (!benefOk) falta2Items.push('completar los datos de tu beneficiario');
    if (!s.legal2) falta2Items.push('marcar la aceptación final');
    const paso2Incompleto = falta2Items.length > 0;

    const medios = [
      { id: 'qr', rotulo: 'QR Bancard' },
      { id: 'debito', rotulo: 'Tarjeta de débito' },
      { id: 'credito', rotulo: 'Tarjeta de crédito' },
    ];
    const rotuloAccionPago = s.medio === 'qr'
      ? 'Tocá acá para generar el QR de Bancard'
      : (s.medio === 'debito' ? 'Tocá acá para pagar con débito →' : 'Tocá acá para pagar con tarjeta de crédito →');
    const iniciarCuentaQr = () => {
      if (this._tQr) clearInterval(this._tQr);
      this._tQr = setInterval(() => {
        const n = this.state.qrSegundos - 1;
        if (n <= 0) {
          clearInterval(this._tQr); this._tQr = null;
          this.setState({ qrSegundos: 0, pagado: true, modalPago: '', screen: 'confirmacion' });
          window.scrollTo(0, 0);
        } else {
          this.setState({ qrSegundos: n });
        }
      }, 1000);
    };
    const abrirPago = () => {
      if (s.medio === 'qr') { this.setState({ modalPago: 'qr', qrGenerado: true, qrSegundos: 5 }); iniciarCuentaQr(); return; }
      this.setState({ modalPago: 'tarjeta', intentoTarjeta: false });
    };
    const cerrarPago = () => {
      if (this._tQr) { clearInterval(this._tQr); this._tQr = null; }
      if (this._tTar) { clearTimeout(this._tTar); this._tTar = null; }
      this.setState({ modalPago: '', qrGenerado: false, qrSegundos: 5, procesandoTarjeta: false });
    };

    const digitos = (v) => v.replace(/\D/g, '');
    const tarNumOk = digitos(s.tarNum).length >= 15;
    const tarVencOk = /^(0[1-9]|1[0-2])\/\d{2}$/.test(s.tarVenc.trim());
    const tarCvvOk = digitos(s.tarCvv).length >= 3;
    const tarTitularOk = s.tarTitular.trim().split(/\s+/).length >= 2;
    const faltaTarjetaItems = [];
    if (!tarNumOk) faltaTarjetaItems.push('el número de la tarjeta');
    if (!tarVencOk) faltaTarjetaItems.push('el vencimiento (MM/AA)');
    if (!tarCvvOk) faltaTarjetaItems.push('el código de seguridad');
    if (!tarTitularOk) faltaTarjetaItems.push('el nombre del titular');
    const tarjetaIncompleta = faltaTarjetaItems.length > 0;
    const fmtTarNum = (v) => digitos(v).slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
    const fmtTarVenc = (v) => {
      const d = digitos(v).slice(0, 4);
      return d.length > 2 ? d.slice(0, 2) + '/' + d.slice(2) : d;
    };
    const pagarTarjeta = () => {
      if (s.procesandoTarjeta) return;
      if (tarjetaIncompleta) { this.setState({ intentoTarjeta: true }); setTimeout(irAlPrimerFaltante, 60); return; }
      this.setState({ procesandoTarjeta: true });
      if (this._tTar) clearTimeout(this._tTar);
      this._tTar = setTimeout(() => {
        this.setState({ procesandoTarjeta: false, pagado: true, modalPago: '', screen: 'confirmacion' });
        window.scrollTo(0, 0);
      }, 1900);
    };

    const inicio = new Date(Date.now() + 24 * 3600 * 1000);
    const inicioCobertura = 'el ' + inicio.toLocaleDateString('es-PY', { day: 'numeric', month: 'long' }) + ' a las ' + inicio.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' });

    const pasoActual = { paso1: 1, paso2: 2, paso3: 3 }[s.screen] || 0;
    const pasosStepper = [
      { num: '1', rotulo: 'INSCRIBITE', n: 1 },
      { num: '2', rotulo: 'ELEGÍ TU SEGURO', n: 2 },
      { num: '3', rotulo: 'PAGÁ Y FIRMÁ', n: 3 },
    ].map(p => ({
      ...p,
      check: p.n < pasoActual ? '✓' : '',
      estilo: `display:flex;gap:8px;align-items:baseline;padding:12px 4px;font-size:12px;border-top:3px solid ${p.n === pasoActual ? 'var(--color-accent-600)' : (p.n < pasoActual ? 'var(--verde)' : 'transparent')};color:${p.n <= pasoActual ? 'var(--color-text)' : 'var(--color-neutral-400)'};font-weight:${p.n === pasoActual ? '700' : '500'};`,
    }));

    const hitos = [
      { rotulo: 'Firma electrónica', detalle: 'Cliente, Interseguros y Alianza', icono: '✓', color: 'var(--color-text)' },
      { rotulo: 'Pago confirmado', detalle: 'Acreditado por Bancard', icono: '✓', color: 'var(--color-text)' },
      { rotulo: 'Certificado provisional', detalle: 'Emitido por Alianza', icono: '✓', color: 'var(--color-text)' },
      { rotulo: 'Póliza y factura', detalle: 'En proceso de emisión', icono: '⋯', color: 'var(--color-accent)' },
    ];
    const documentos = [
      { rotulo: 'Certificado de Cobertura Provisional', detalle: 'CPC-00018425 · firmado por Alianza Garantía · SHA-256 registrado', accion: 'Ver PDF', abrir: this.abrir('cpc') },
      { rotulo: 'Propuesta de Interseguros + FIPF (firmada)', detalle: 'PROP-00018425 · cliente, Interseguros y Alianza · SHA-256 registrado', accion: 'Ver PDF', abrir: this.abrir('fipf') },
      { rotulo: 'Comprobante de pago del premio', detalle: 'REC-00018425 · ' + this.gs(plan.premio) + ' vía Bancard', accion: 'Ver PDF', abrir: this.abrir('recibo') },
      { rotulo: 'Póliza definitiva', detalle: 'En emisión por Alianza Garantía · llega por correo y WhatsApp', accion: 'Ver PDF', abrir: this.abrir('poliza') },
    ];

    const docActual = s.doc ? this.docs()[s.doc] : null;

    return {
      tema: s.tema,
      rotuloTema: s.tema === 'noche' ? '☼ Modo día' : '☾ Modo noche',
      alternarTema: () => this.setState(st => ({ tema: st.tema === 'noche' ? 'dia' : 'noche' })),
      verQueEsFipf: s.verQueEsFipf,
      rotuloQueEsFipf: s.verQueEsFipf ? 'Ocultar el detalle' : '¿Qué es el FIPF y qué estoy firmando?',
      alternarQueEsFipf: this.flip('verQueEsFipf'),
      verCanales: identidadOk, bloqCanales: !identidadOk,
      faltaIdentidad: 'Se habilita cuando confirmes tus datos de identidad.',
      verComplementarios: identidadOk && s.otpOk && correoOk,
      bloqComplementarios: identidadOk && !(s.otpOk && correoOk),
      faltaCanales: !correoOk ? 'Se habilita cuando declares tu correo dos veces iguales y verifiques tu WhatsApp.' : 'Se habilita cuando verifiques tu WhatsApp con el código.',
      verAceptacion: identidadOk && s.otpOk && correoOk && complementariosOk,
      bloqAceptacion: identidadOk && s.otpOk && correoOk && !complementariosOk,
      faltaComplementarios: 'Se habilita cuando completes tus datos complementarios.',
      modoDemoOn,
      esInicio: s.screen === 'inicio', esPaso1: s.screen === 'paso1', esPaso2: s.screen === 'paso2',
      esPaso3: s.screen === 'paso3', esConfirmacion: s.screen === 'confirmacion', esRevision: s.screen === 'revision',
      noEsInicio: s.screen !== 'inicio',
      tycAceptado: s.tycInicio, tycPendiente: !s.tycInicio,
      aceptarTyc: () => this.setState({ tycInicio: true }),
      guiaInicio: s.tycInicio ? 'Tené a mano tu cédula vigente y tu celular con cámara.' : 'Aceptá los términos y condiciones para continuar.',
      enPasos: ['paso1', 'paso2', 'paso3'].includes(s.screen),
      pasosStepper,
      irPaso1: seguirO(!s.tycInicio, 'paso1'),
      irPaso2: seguirO(paso1Incompleto, 'paso2'),
      irPaso3: seguirO(paso2Incompleto, 'paso3'),
      volverPaso2: this.nav('paso2'), irRevision: this.nav('revision'), reiniciar: this.nav('inicio'),

      capturas, sinCapturas: !capsOk,
      guiaOcr: capsOk ? 'Tarda unos segundos.' : 'Primero completá las tres capturas de arriba.',
      leerDocumento,
      ocrPendiente: s.ocr === 'pendiente', ocrProcesando: s.ocr === 'procesando', ocrListo: s.ocr === 'listo',
      datosVisibles: s.ocr === 'listo',

      nombres: s.nombres, apellidos: s.apellidos, cedula: s.cedula, fnac: s.fnac,
      sexo: s.sexo, nacionalidad: s.nacionalidad, paisNac: s.paisNac, paisRes: s.paisRes, estadoCivil: s.estadoCivil,
      onNombres: this.set('nombres'), onApellidos: this.set('apellidos'), onSexo: this.set('sexo'),
      onNacionalidad: this.set('nacionalidad'), onPaisNac: this.set('paisNac'), onPaisRes: this.set('paisRes'), onEstadoCivil: this.set('estadoCivil'),
      opcSexo: ['', 'Femenino', 'Masculino'],
      opcNacionalidad: ['', 'Paraguaya', 'Argentina', 'Brasileña', 'Otra'],
      opcPaises: ['', 'Paraguay', 'Argentina', 'Brasil', 'Otro'],
      opcEstadoCivil: ['', 'Soltera/o', 'Casada/o', 'Unión de hecho', 'Divorciada/o', 'Viuda/o'],

      falNombres: req(s.nombres.trim().length > 1), falApellidos: req(s.apellidos.trim().length > 1),
      falSexo: req(!!s.sexo), falNacionalidad: req(!!s.nacionalidad), falPaisNac: req(!!s.paisNac),
      falPaisRes: req(!!s.paisRes), falEstadoCivil: req(!!s.estadoCivil),
      falCelular: req(s.celular.replace(/\D/g, '').length >= 6),
      falCorreo: req(s.correo.includes('@')), falCorreo2: req(s.correo2.length > 3 && s.correo === s.correo2),
      falDomicilio: req(s.domicilio.trim().length > 3), falCiudad: req(!!s.ciudad),
      falLaboral: req(!!s.laboral), falActividad: req(!!s.actividad), falProfesion: req(!!s.profesion),
      falEmpresa: req(s.empresa.trim().length > 1), falIngreso: req(!!s.ingreso), falOrigen: req(!!s.origen),
      falBenefNombre: req(s.benefNombre.trim().length > 1), falBenefCedula: req(s.benefCedula.trim().length > 3),
      falBenefFnac: req(s.benefFnac.trim().length > 5), falBenefParentesco: req(!!s.benefParentesco),
      falBenefDomicilio: req(s.benefDomicilio.trim().length > 5),
      falBenefCelular: req(s.benefCelular.replace(/\D/g, '').length >= 6),

      celular: s.celular, correo: s.correo, correo2: s.correo2,
      onCelular: this.set('celular'), onCorreo: this.set('correo'), onCorreo2: this.set('correo2'),
      correoNoCoincide,

      domicilio: s.domicilio, ciudad: s.ciudad, laboral: s.laboral, actividad: s.actividad,
      profesion: s.profesion, empresa: s.empresa, ingreso: s.ingreso, origen: s.origen, ruc: s.ruc,
      onDomicilio: this.set('domicilio'), onCiudad: this.set('ciudad'), onLaboral: this.set('laboral'),
      onActividad: this.set('actividad'), onProfesion: this.set('profesion'), onEmpresa: this.set('empresa'),
      onIngreso: this.set('ingreso'), onOrigen: this.set('origen'), onRuc: this.set('ruc'),
      opcCiudades: ['', 'Asunción', 'Ciudad del Este', 'Encarnación', 'Fernando de la Mora', 'Lambaré', 'Luque', 'San Lorenzo', 'Otra'],
      opcLaboral: ['', 'Relación de dependencia', 'Independiente', 'Empleador/a', 'Jubilada/o o pensionada/o', 'Estudiante', 'Sin actividad remunerada'],
      opcActividad: ['', 'Comercio', 'Servicios', 'Industria', 'Agropecuaria', 'Construcción', 'Salud', 'Educación', 'Sector público', 'Financiera', 'Otra'],
      opcProfesion: ['', 'Administrativa/o', 'Comerciante', 'Docente', 'Profesional de la salud', 'Ingeniera/o', 'Abogada/o', 'Técnica/o', 'Otra'],
      opcIngreso: ['', 'Hasta 2.800.000', 'De 2.800.001 a 5.000.000', 'De 5.000.001 a 10.000.000', 'De 10.000.001 a 20.000.000', 'Más de 20.000.000'],
      opcOrigen: ['', 'Salario en relación de dependencia', 'Actividad independiente', 'Renta de negocio propio', 'Jubilación o pensión', 'Rentas e inversiones', 'Otro'],

      ...vals,
      nombreCompleto: nombreCompleto || 'Tu nombre',
      nombrePila: nombrePila || 'Listo',
      tituloPaso1: nombrePila ? `Inscribite con nosotros, ${nombrePila}` : 'Inscribite con nosotros',
      tituloOtp: con('verificá tu WhatsApp personal'),
      tituloIdentidad: con('empecemos por tu cédula'),
      tituloPaso2: con('elegí el plan que más te convenga'),
      tituloBenef: con('¿a quién protegés?'),
      tituloDecl: con('unas preguntas antes de seguir'),
      tituloPaso3: con('pagá y firmá tu contrato'),
      tituloFirma: con('primero, tu firma'),
      tituloPago: nombrePila ? `Después, el pago, ${nombrePila}` : 'Después, el pago',
      tituloConfirmacion: nombrePila ? `¡Listo, ${nombrePila}! Tu familia ya está protegida` : '¡Listo! Tu familia ya está protegida',
      tituloRevision: con('tu solicitud queda en buenas manos'),

      rellenarDemo: () => this.setState({
        celular: '+595 981 234 468', correo: 'ana.gonzalez@gmail.com', correo2: 'ana.gonzalez@gmail.com',
        domicilio: 'Avda. España 1234, Villa Morra', ciudad: 'Asunción',
        laboral: 'Relación de dependencia', actividad: 'Servicios', profesion: 'Administrativa/o',
        empresa: 'Comercial del Este S.A.', ingreso: 'De 5.000.001 a 10.000.000', origen: 'Salario en relación de dependencia',
      }),

      otpNoEnviado: !s.otpEnviado && !s.otpOk,
      otpPendiente: s.otpEnviado && !s.otpOk,
      otpOk: s.otpOk, otpCodigo: s.otpCodigo,
      sinCelular: s.celular.replace(/\D/g, '').length < 6,
      otpIncompleto: s.otpCodigo.replace(/\D/g, '').length < 6,
      enviarOtp: (e) => {
        if (e && e.preventDefault) e.preventDefault();
        if (this._tOtp) clearInterval(this._tOtp);
        this.setState(st => ({ otpEnviado: true, otpCodigo: '', otpVence: 300, otpEnvios: Math.min(3, st.otpEnvios + 1) }));
        this._tOtp = setInterval(() => {
          const n = this.state.otpVence - 1;
          if (n <= 0) { clearInterval(this._tOtp); this._tOtp = null; this.setState({ otpVence: 0 }); }
          else this.setState({ otpVence: n });
        }, 1000);
      },
      onOtp: (e) => {
        const v = e.target.value;
        this.setState({ otpCodigo: v });
        if (v.replace(/\D/g, '').length === 6 && this.state.otpVence > 0) {
          setTimeout(() => {
            if (this._tOtp) { clearInterval(this._tOtp); this._tOtp = null; }
            this.setState({ otpOk: true });
          }, 700);
        }
      },
      otpReloj: Math.floor(s.otpVence / 60) + ':' + String(s.otpVence % 60).padStart(2, '0'),
      colorReloj: s.otpVence === 0 ? 'var(--color-accent)' : (s.otpVence < 60 ? 'var(--color-accent-700)' : 'var(--color-text)'),
      otpEnvios: s.otpEnvios,
      rotuloReenvio: s.otpEnvios >= 3 ? 'Sin reenvíos disponibles' : 'Reenviar código',
      guiaOtp: s.otpVence === 0
        ? 'El código venció. Pedí uno nuevo para seguir.'
        : 'Enviado a ' + mask(s.celular) + ' · se verifica solo al completar los 6 dígitos. Nadie de SeguroLoTengo, Interseguros o Alianza te lo va a pedir por llamada.',
      celularEnmascarado: mask(s.celular),
      correoEnmascarado: maskMail(s.correo),

      legal1: s.legal1, legal2: s.legal2, legal3: s.legal3,
      toggleLegal1: () => this.setState(st => ({ legal1: !st.legal1 })),
      toggleLegal2: () => this.setState(st => ({ legal2: !st.legal2 })),
      toggleLegal3: () => this.setState(st => ({ legal3: !st.legal3 })),
      verLegal1: s.verLegal1, verLegal2: s.verLegal2, verLegal3: s.verLegal3,
      toggleVerLegal1: this.flip('verLegal1'), toggleVerLegal2: this.flip('verLegal2'), toggleVerLegal3: this.flip('verLegal3'),
      rotuloVerLegal1: s.verLegal1 ? 'Ocultar el detalle' : 'Ver todo lo que aceptás',
      rotuloVerLegal2: s.verLegal2 ? 'Ocultar el detalle' : 'Ver todo lo que aceptás',
      rotuloVerLegal3: s.verLegal3 ? 'Ocultar el detalle' : 'Ver todo lo que aceptás',
      paso1Incompleto,
      hayFalta1: paso1Incompleto,
      faltaLegal1: s.legal1 ? '' : '1',
      faltaLegal2: s.legal2 ? '' : '1',
      faltaLegal3: (s.legal3 || s.firmado) ? '' : '1',
      falta1: 'Te falta: ' + falta1Items.join(', ') + '.',
      irAlPrimerFaltante,

      ramos, planes, planNombre: plan.nombre, planPremioFmt: this.gs(plan.premio), coberturas,
      primaNetaFmt: this.gs(primaNeta), ivaFmt: this.gs(plan.premio - primaNeta),
      benefEsPersona: s.benef === 'persona',
      benefEsHerederos: s.benef === 'herederos',
      claseBenefHerederos: s.benef === 'herederos' ? 'btn btn-primary' : 'btn btn-ghost',
      claseBenefPersona: s.benef === 'persona' ? 'btn btn-primary' : 'btn btn-ghost',
      benefHerederos: () => this.setState({ benef: 'herederos' }),
      benefPersona: () => this.setState({ benef: 'persona' }),
      benefNombre: s.benefNombre, benefParentesco: s.benefParentesco, benefCedula: s.benefCedula,
      benefFnac: s.benefFnac, benefDomicilio: s.benefDomicilio, benefCelular: s.benefCelular,
      onBenefNombre: this.set('benefNombre'), onBenefParentesco: this.set('benefParentesco'),
      onBenefCedula: this.set('benefCedula'), onBenefFnac: this.set('benefFnac'),
      onBenefDomicilio: this.set('benefDomicilio'), onBenefCelular: this.set('benefCelular'),
      opcParentesco: ['', 'Cónyuge o conviviente', 'Hija/o', 'Madre o padre', 'Hermana/o', 'Otro familiar', 'Sin parentesco'],
      declaraciones,
      sinIncompatibles: !hayIncompatibles, hayIncompatibles,
      paso2Incompleto, paso2SinResponder: !respondidas,
      hayFalta2: paso2Incompleto && !hayIncompatibles,
      falta2: 'Te falta: ' + falta2Items.join(', ') + '.',

      firmado: s.firmado, noFirmado: !s.firmado,
      noPuedeFirmar: !s.legal3,
      firmar: () => { if (!s.legal3) { irAlPrimerFaltante(); return; } this.setState({ firmado: true }); },
      mediosPago: medios.map(m => ({
        rotulo: m.rotulo,
        clase: s.medio === m.id ? 'btn btn-secondary' : 'btn btn-ghost',
        elegir: () => { if (this._tQr) { clearInterval(this._tQr); this._tQr = null; } if (this._tTar) { clearTimeout(this._tTar); this._tTar = null; } this.setState({ medio: m.id, qrGenerado: false, qrSegundos: 5, procesandoTarjeta: false }); },
      })),
      qrGenerado: s.qrGenerado, noPagado: !s.pagado,
      abrirPago, cerrarPago,
      confirmarQrDemo: () => {
        if (this._tQr) { clearInterval(this._tQr); this._tQr = null; }
        this.setState({ qrSegundos: 0, pagado: true, modalPago: '', screen: 'confirmacion' });
        window.scrollTo(0, 0);
      },
      pagoAbierto: s.modalPago !== '',
      esModalQr: s.modalPago === 'qr',
      esModalTarjeta: s.modalPago === 'tarjeta',
      rellenarTarjetaDemo: () => this.setState({ tarNum: '4509 8765 1234 0987', tarVenc: '09/29', tarCvv: '123', tarTitular: ((s.nombres + ' ' + s.apellidos).trim() || 'Ana María González Ramírez') }),
      tituloTarjeta: s.medio === 'debito' ? 'Pagá con tu tarjeta de débito' : 'Pagá con tu tarjeta de crédito',
      tarNum: s.tarNum, tarVenc: s.tarVenc, tarCvv: s.tarCvv, tarTitular: s.tarTitular,
      onTarNum: (e) => this.setState({ tarNum: fmtTarNum(e.target.value) }),
      onTarVenc: (e) => this.setState({ tarVenc: fmtTarVenc(e.target.value) }),
      onTarCvv: (e) => this.setState({ tarCvv: digitos(e.target.value).slice(0, 4) }),
      onTarTitular: (e) => this.setState({ tarTitular: e.target.value }),
      falTarNum: req(tarNumOk || !s.intentoTarjeta), falTarVenc: req(tarVencOk || !s.intentoTarjeta),
      falTarCvv: req(tarCvvOk || !s.intentoTarjeta), falTarTitular: req(tarTitularOk || !s.intentoTarjeta),
      tarjetaIncompleta, avisoTarjeta: tarjetaIncompleta && s.intentoTarjeta,
      procesandoTarjeta: s.procesandoTarjeta, tarjetaEditable: !s.procesandoTarjeta,
      faltaTarjeta: 'Te falta: ' + faltaTarjetaItems.join(', ') + '.',
      rotuloPagarTarjeta: 'Tocá acá para pagar ' + this.gs(plan.premio) + ' →',
      pagarTarjeta,
      qrReloj: '00:0' + Math.max(0, s.qrSegundos),
      guiaQr: (nombrePila ? nombrePila + ', escaneá' : 'Escaneá') + ' este QR desde tu app de pagos — apenas Bancard confirme el pago seguimos automáticamente, no hace falta que hagas nada más.',
      rotuloAccionPago,
      ctaVisible: !!s.ctaTexto && s.modalPago === '' && !s.doc, ctaTexto: s.ctaTexto,
      irAlCta: () => { const n = this._ctaNodo; if (!n) return; const r = n.getBoundingClientRect();
        window.scrollTo({ top: window.scrollY + r.top - (window.innerHeight - r.height - 100), behavior: 'smooth' }); },
      inicioCobertura, hitos, documentos,
      optComercial: s.optComercial, toggleOptComercial: () => this.setState(st => ({ optComercial: !st.optComercial })),
      estadoOptComercial: s.optComercial ? 'Registramos tu autorización con fecha, hora y la versión del texto.' : 'Hoy no autorizaste publicidad.',
      verFooter: s.verFooter || (this.props.legalExpandido ?? false),
      toggleFooter: this.flip('verFooter'),
      flechaFooter: (s.verFooter || (this.props.legalExpandido ?? false)) ? '▴' : '▾',

      ver: {
        fipf: this.abrir('fipf'), cpc: this.abrir('cpc'), recibo: this.abrir('recibo'), poliza: this.abrir('poliza'),
        coberturas: this.abrir('coberturas'), condiciones: this.abrir('condiciones'),
        tyc: this.abrir('tyc'), privacidad: this.abrir('privacidad'),
        usoDatos: this.abrir('usoDatos'), cuidado: this.abrir('cuidado'),
        reclamos: this.abrir('reclamos'), retracto: this.abrir('retracto'), verificacion: this.abrir('verificacion'),
        resAlianza: this.abrir('resAlianza'), resInter: this.abrir('resInter'), resSlt: this.abrir('resSlt'),
        sitioAlianza: this.abrir('sitioAlianza'), sitioInter: this.abrir('sitioInter'), sitioSlt: this.abrir('sitioSlt'),
      },
      docAbierto: !!docActual,
      docTipo: docActual ? docActual.tipo : '',
      docTitulo: docActual ? docActual.titulo : '',
      docMeta: docActual ? docActual.meta : '',
      docSecciones: docActual ? docActual.secciones : [],
      docPie: docActual ? docActual.pie : '',
      docEsSitio: !!(docActual && docActual.sitio),
      docNoEsSitio: !!(docActual && !docActual.sitio),
      rotuloDescarga: docActual && docActual.sitio ? 'Volver al flujo' : 'Descargar (simulado)',
      cerrarDoc: () => this.setState({ doc: null }),
      frenarCierre: (e) => { if (e && e.stopPropagation) e.stopPropagation(); },
    };
  }
}
