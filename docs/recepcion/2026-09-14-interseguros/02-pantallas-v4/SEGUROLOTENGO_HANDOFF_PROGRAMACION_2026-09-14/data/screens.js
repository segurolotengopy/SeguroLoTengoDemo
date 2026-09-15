window.SEGUROLOTENGO_HANDOFF = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "meta": {
    "project": "SeguroLoTengo.com",
    "deliverable": "Handoff técnico de pantallas recuperadas",
    "version": "2026-09-14.1",
    "locale": "es-PY",
    "currency": "PYG",
    "generated_at": "2026-09-14",
    "scope": "Pantallas recuperadas y verificadas; no completa las vistas todavía no aprobadas.",
    "authority_order": [
      "Imagen APROBADA FINAL correspondiente al código y estado",
      "Especificación JSON aprobada vinculada",
      "Reglas globales consolidadas en este archivo"
    ],
    "counts": {
      "approved_visual_artifacts": 81,
      "approved_runtime_views": 79,
      "approved_summary_boards": 2,
      "candidate_visual_artifacts": 22,
      "total_visual_artifacts": 103
    }
  },
  "release_rule": {
    "implementation_source": "Solo registros con approval_status=APROBADA_FINAL y approved_for_development=true.",
    "candidate_policy": "No implementar como definitivo. Conservar únicamente como referencia pendiente.",
    "change_control": "No alterar estructura, contenido, orden, textos, nombres, campos, logotipo ni diseño sin aprobación expresa."
  },
  "brand": {
    "typography": {
      "primary": "Nimbus Sans",
      "fallback": [
        "Arial",
        "Helvetica",
        "sans-serif"
      ]
    },
    "colors": {
      "navy": "#071F78",
      "red": "#FF1721",
      "blue": "#0876F9",
      "muted_blue": "#55709D",
      "white": "#FFFFFF"
    },
    "header": {
      "cover_brands": 2,
      "contracting_brands": 3,
      "channel": "SeguroLoTengo — canal digital",
      "intermediary": "Interseguros S.A. — Corredor de Seguros, Matrícula SIS N.º 118",
      "insurer": "Alianza Garantía Seguros y Reaseguros S.A."
    },
    "logo_rule": "Usar exclusivamente el logotipo nuevo visible en los artes aprobados, conservando sus proporciones. No sustituirlo, redibujarlo ni agregar sombreado naranja o líneas decorativas no aprobadas."
  },
  "layout_contract": {
    "mobile_first": true,
    "responsive_to_any_width": true,
    "progress_stages": 5,
    "primary_cta": {
      "color": "#FF1721",
      "consistent_vertical_position": true
    },
    "body_min_font_px": 16,
    "preserve_visual_hierarchy_from_reference": true
  },
  "institutional_roles": {
    "SeguroLoTengo": "Marca y canal digital de Interseguros S.A.",
    "Interseguros": "Intermediario de la contratación y canal de atención.",
    "Alianza": "Aseguradora que emite la póliza, asume el riesgo y paga las indemnizaciones cuando corresponda."
  },
  "product": {
    "commercial_name": "Seguro de Vida Oncológico VIVE",
    "registered_name": "Seguro de Vida Individual con Indemnización Adicional por Diagnóstico de Cáncer",
    "registration_code": "15-VI.0002",
    "registration_note": "Nota SS.SG. N.º 397/2026",
    "plans": [
      {
        "id": "vive",
        "name": "VIVE",
        "annual_total_pyg_vat_included": 390000,
        "recommended": false,
        "coverages": {
          "cancer_diagnosis_pyg": 50000000,
          "death_pyg": 3500000,
          "hospital_income_accident_pyg_per_day": 500000,
          "hospital_income_max_days": 15,
          "accident_medical_expenses_pyg": 7000000
        }
      },
      {
        "id": "vive_plus",
        "name": "VIVE+",
        "annual_total_pyg_vat_included": 575000,
        "recommended": false,
        "coverages": {
          "cancer_diagnosis_pyg": 75000000,
          "death_pyg": 5000000,
          "hospital_income_accident_pyg_per_day": 750000,
          "hospital_income_max_days": 15,
          "accident_medical_expenses_pyg": 10000000
        }
      },
      {
        "id": "vive_total",
        "name": "VIVE TOTAL",
        "annual_total_pyg_vat_included": 760000,
        "recommended": true,
        "coverages": {
          "cancer_diagnosis_pyg": 100000000,
          "death_pyg": 7000000,
          "hospital_income_accident_pyg_per_day": 1000000,
          "hospital_income_max_days": 15,
          "accident_medical_expenses_pyg": 14000000
        }
      }
    ],
    "eligibility": {
      "entry_age_min": 18,
      "entry_age_max": 64,
      "country_scope": "Paraguay"
    },
    "waiting_periods": {
      "cancer_days": 90,
      "hospital_income_accident_days": 1,
      "accident_medical_expenses_days": 1,
      "death_days": 0
    },
    "coverage_start": "Cuando el pago quede acreditado."
  },
  "functional_contract": {
    "otp": {
      "channel_primary": "WhatsApp",
      "fallback": "SMS",
      "length": 6,
      "validity_minutes": 5,
      "max_attempts": 3,
      "resend_wait_seconds": 60,
      "success_next_screen": "03B"
    },
    "identity": {
      "accepted_document": "Cédula de identidad paraguaya vigente",
      "passport_allowed": false,
      "required_captures": [
        "frente",
        "dorso",
        "selfie"
      ],
      "checks": [
        "calidad",
        "lado correcto",
        "vigencia",
        "posible alteración",
        "prueba de vida",
        "coincidencia facial"
      ],
      "email_confirmation_required": true
    },
    "personal_data": {
      "all_visible_fields_required": true,
      "extracted_fields_editable": true,
      "document_type_editable": false,
      "edits_logged": true,
      "age_rule": "Solo 18 a 64 años.",
      "linked_spec": "data/PANTALLA_03D_ESPECIFICACION_Y_CATALOGOS_APROBADA_FINAL.json"
    },
    "work_income_candidate": {
      "status": "NO_APROBADO",
      "fields": [
        "situación laboral",
        "actividad económica",
        "profesión",
        "ocupación u oficio",
        "empresa o empleador cuando corresponda",
        "ingreso mensual declarado manualmente",
        "un solo origen de ingresos",
        "condición PEP o vínculo PEP"
      ],
      "manual_review_when_pep_yes": true
    },
    "medical": {
      "questions": [
        {
          "id": "health_status",
          "text": "Declaro que me encuentro en buen estado de salud y que no estoy contratando este seguro para cubrir una enfermedad, diagnóstico o condición médica preexistente.",
          "compatible_answer": "SI"
        },
        {
          "id": "insurance_history",
          "text": "¿Alguna aseguradora rechazó, postergó o condicionó alguna solicitud suya de seguro de vida, de salud o de características similares?",
          "compatible_answer": "NO"
        },
        {
          "id": "diagnosed_diseases",
          "text": "¿Le han diagnosticado o está actualmente en tratamiento por cáncer, enfermedad cardiovascular, insuficiencia renal, diabetes, esclerosis, enfermedad autoinmune, inmunodeficiencia, hepatitis o cirrosis?",
          "compatible_answer": "NO"
        }
      ],
      "non_compatible_result": "04A1",
      "automatic_rejection": false
    },
    "beneficiary": {
      "screen": "04A",
      "visible_fields": [
        "nombre completo",
        "domicilio completo",
        "parentesco",
        "número de cédula del beneficiario"
      ],
      "required_as_rendered": true,
      "separate_04B_screen": false
    },
    "manual_review": {
      "signature_requested": false,
      "payment_requested": false,
      "coverage_started": false,
      "case_number_created_on_success": true,
      "communications_only_through_declared_channels": true
    },
    "signature_payment": {
      "status": "PENDIENTE_DE_ARTE_APROBADO",
      "client_signature": "Firma electrónica no cualificada mediante OTP web de Interseguros.",
      "intermediary_signature": "Firma electrónica cualificada Code100.",
      "insurer_signature": "Firma electrónica cualificada del proveedor de Alianza.",
      "sequence": [
        "firma del cliente",
        "pago Bancard"
      ],
      "payment_deadline_minutes_after_signature": 10,
      "payment_methods": [
        "vPOS tarjeta",
        "QR Bancard"
      ]
    }
  },
  "consents": [
    {
      "id": "biometric_identity",
      "screen": "03C",
      "required": true,
      "text": "Autorizo expresamente el uso de mi imagen y datos biométricos, su comparación con mi cédula y la prueba de vida, exclusivamente para verificar mi identidad para la contratación del seguro."
    },
    {
      "id": "whatsapp_verification_and_marketing",
      "screen": "03A",
      "required": true,
      "text": "Autorizo el envío de un código por WhatsApp para verificar que el número indicado es de mi propiedad y se encuentra bajo mi control. Asimismo, autorizo el envío de publicidad y ofertas de seguros intermediados por Interseguros S.A. por este mismo canal, autorización que podré retirar en cualquier momento."
    },
    {
      "id": "digital_delivery",
      "screen": "04D",
      "required": true,
      "text": "Autorizo y acepto recibir por mis canales verificados (WhatsApp y correo electrónico) el Certificado de Cobertura Provisional, la póliza y la factura electrónica, así como la Solicitud de Seguro y el FIPF firmados cuando los requiera."
    },
    {
      "id": "coverage_waiting_periods",
      "screen": "04D",
      "required": true,
      "text": "Tomo conocimiento y acepto que la cobertura comenzará una vez acreditado el pago de la prima. Carencias: cáncer, 90 días; renta hospitalaria por accidente, 1 día; gastos médicos por accidente, 1 día; fallecimiento, sin carencia."
    },
    {
      "id": "intermediary_channel",
      "screen": "04D",
      "required": true,
      "text": "Tomo conocimiento de que Interseguros S.A. es el intermediario en la contratación de este seguro y será el canal de atención para todas las gestiones relacionadas con la póliza."
    }
  ],
  "screen_groups": [
    {
      "screen_code": "01",
      "title": "Portada y catálogo de productos",
      "stage": 1,
      "status": "approved",
      "purpose": "Presentar la marca, beneficios y catálogo; Oncológico está disponible y los demás productos se muestran como próximos.",
      "primary_action": "Seleccionar Oncológico",
      "approved_runtime_views": 1,
      "candidate_views": 1,
      "artifacts": [
        "pantalla-01-aprobada-final",
        "pantalla-01-caratula-catalogo-candidata"
      ]
    },
    {
      "screen_code": "01A",
      "title": "Detalle de cookies",
      "stage": 1,
      "status": "approved",
      "purpose": "Informar sobre cookies necesarias y Google Analytics sin cookies publicitarias.",
      "primary_action": "Entendido",
      "approved_runtime_views": 1,
      "candidate_views": 0,
      "artifacts": [
        "pantalla-01a-detalle-cookies-aprobada-final"
      ]
    },
    {
      "screen_code": "01B",
      "title": "Menú y confirmación de salida",
      "stage": 1,
      "status": "approved",
      "purpose": "Mostrar la navegación y pedir confirmación antes de abandonar una contratación iniciada.",
      "primary_action": "Confirmar o cancelar salida",
      "approved_runtime_views": 2,
      "candidate_views": 0,
      "artifacts": [
        "pantalla-01b-confirmacion-salida-aprobada-final",
        "pantalla-01b-menu-aprobada-final"
      ]
    },
    {
      "screen_code": "01C",
      "title": "Responsabilidades institucionales",
      "stage": 1,
      "status": "approved",
      "purpose": "Explicar el rol del canal, el intermediario y la aseguradora.",
      "primary_action": "Volver",
      "approved_runtime_views": 1,
      "candidate_views": 0,
      "artifacts": [
        "pantalla-01c-responsabilidades-aprobada-final"
      ]
    },
    {
      "screen_code": "01D",
      "title": "Contacto",
      "stage": 1,
      "status": "approved",
      "purpose": "Presentar los canales oficiales de atención.",
      "primary_action": "Volver",
      "approved_runtime_views": 1,
      "candidate_views": 0,
      "artifacts": [
        "pantalla-01d-contacto-aprobada-final"
      ]
    },
    {
      "screen_code": "01E",
      "title": "Información legal",
      "stage": 1,
      "status": "approved",
      "purpose": "Presentar la información legal institucional aplicable al canal.",
      "primary_action": "Volver",
      "approved_runtime_views": 1,
      "candidate_views": 0,
      "artifacts": [
        "pantalla-01e-informacion-legal-aprobada-final"
      ]
    },
    {
      "screen_code": "02",
      "title": "Selección de plan",
      "stage": 2,
      "status": "approved",
      "purpose": "Comparar y seleccionar uno de los tres planes VIVE; no se preselecciona ningún plan.",
      "primary_action": "Continuar",
      "approved_runtime_views": 1,
      "candidate_views": 0,
      "artifacts": [
        "pantalla-02-seleccion-plan-aprobada-final"
      ]
    },
    {
      "screen_code": "02A",
      "title": "Coberturas",
      "stage": 2,
      "status": "approved",
      "purpose": "Desplegar el detalle de las coberturas del producto.",
      "primary_action": "Volver a planes",
      "approved_runtime_views": 1,
      "candidate_views": 0,
      "artifacts": [
        "pantalla-02a-coberturas-aprobada-final"
      ]
    },
    {
      "screen_code": "02B",
      "title": "Exclusiones",
      "stage": 2,
      "status": "approved",
      "purpose": "Desplegar exclusiones y condiciones relevantes antes de continuar.",
      "primary_action": "Volver a planes",
      "approved_runtime_views": 1,
      "candidate_views": 0,
      "artifacts": [
        "pantalla-02b-exclusiones-aprobada-final"
      ]
    },
    {
      "screen_code": "02C",
      "title": "Siniestros",
      "stage": 2,
      "status": "approved",
      "purpose": "Explicar cómo comunicar y gestionar un siniestro.",
      "primary_action": "Volver",
      "approved_runtime_views": 1,
      "candidate_views": 0,
      "artifacts": [
        "pantalla-02c-siniestros-aprobada-final"
      ]
    },
    {
      "screen_code": "03A",
      "title": "Verificación de WhatsApp",
      "stage": 3,
      "status": "approved",
      "purpose": "Verificar titularidad y control del número mediante OTP, con contingencia por SMS.",
      "primary_action": "Enviar o verificar código",
      "approved_runtime_views": 18,
      "candidate_views": 0,
      "artifacts": [
        "pantalla-03a-00-verificacion-whatsapp-estado-inicial-aprobada-final",
        "pantalla-03a-01a-autorizacion-pendiente-aprobada-final",
        "pantalla-03a-01b-numero-invalido-aprobada-final",
        "pantalla-03a-01-datos-listos-para-envio-aprobada-final",
        "pantalla-03a-02-enviando-codigo-aprobada-final",
        "pantalla-03a-03-codigo-whatsapp-enviado-aprobada-final",
        "pantalla-03a-04-otp-completo-aprobada-final",
        "pantalla-03a-05-verificando-otp-aprobada-final",
        "pantalla-03a-06-codigo-incorrecto-aprobada-final",
        "pantalla-03a-07-codigo-invalidado-tercer-intento-aprobada-final",
        "pantalla-03a-08-reenvio-whatsapp-realizado-aprobada-final",
        "pantalla-03a-09-codigo-whatsapp-vencido-aprobada-final",
        "pantalla-03a-10-sms-disponible-aprobada-final",
        "pantalla-03a-11-codigo-sms-enviado-aprobada-final",
        "pantalla-03a-12-bloqueo-temporal-aprobada-final",
        "pantalla-03a-13-error-tecnico-envio-aprobada-final",
        "pantalla-03a-14-numero-sin-whatsapp-aprobada-final",
        "pantalla-03a-15-verificacion-exitosa-aprobada-final"
      ]
    },
    {
      "screen_code": "03B",
      "title": "Preparación y aviso de privacidad",
      "stage": 3,
      "status": "approved",
      "purpose": "Preparar cédula y cámara, e informar el tratamiento de datos antes de la captura.",
      "primary_action": "Comenzar verificación",
      "approved_runtime_views": 4,
      "candidate_views": 0,
      "artifacts": [
        "pantalla-03b-00-prepare-lo-necesario-estado-inicial-aprobada-final",
        "pantalla-03b-01-prepare-lo-necesario-listo-aprobada-final",
        "pantalla-03b-02a-aviso-privacidad-unificado-inicio-aprobada-final",
        "pantalla-03b-02b-aviso-privacidad-unificado-final-aprobada-final"
      ]
    },
    {
      "screen_code": "03C",
      "title": "Captura y validación de identidad",
      "stage": 3,
      "status": "approved",
      "purpose": "Capturar frente, dorso y selfie; ejecutar calidad, vigencia, prueba de vida y coincidencia facial; validar correo.",
      "primary_action": "Validar identidad y correo y continuar",
      "approved_runtime_views": 26,
      "candidate_views": 0,
      "artifacts": [
        "pantalla-03c-00-estado-inicial-aprobada-final",
        "pantalla-03c-01-camara-frente-aprobada-final",
        "pantalla-03c-02-frente-procesando-aprobada-final",
        "pantalla-03c-03-frente-validado-dorso-habilitado-aprobada-final",
        "pantalla-03c-04-camara-dorso-aprobada-final",
        "pantalla-03c-05-dorso-procesando-aprobada-final",
        "pantalla-03c-06-documento-validado-selfie-habilitada-aprobada-final",
        "pantalla-03c-07-camara-selfie-aprobada-final",
        "pantalla-03c-08-selfie-procesando-aprobada-final",
        "pantalla-03c-09-identidad-validada-correo-habilitado-aprobada-final",
        "pantalla-03c-10-correo-invalido-aprobada-final",
        "pantalla-03c-11-correos-no-coinciden-aprobada-final",
        "pantalla-03c-12-listo-para-validar-aprobada-final",
        "pantalla-03c-13-validacion-final-procesando-aprobada-final",
        "pantalla-03c-14-imagen-rechazada-calidad-aprobada-final",
        "pantalla-03c-15-archivo-no-admitido-aprobada-final",
        "pantalla-03c-16-lado-incorrecto-o-repetido-aprobada-final",
        "pantalla-03c-17-documento-no-paraguayo-aprobada-final",
        "pantalla-03c-18-cedula-vencida-aprobada-final",
        "pantalla-03c-19-posible-alteracion-aprobada-final",
        "pantalla-03c-20-camara-denegada-documento-aprobada-final",
        "pantalla-03c-21-camara-denegada-selfie-aprobada-final",
        "pantalla-03c-22-prueba-de-vida-fallida-aprobada-final",
        "pantalla-03c-23-coincidencia-facial-fallida-aprobada-final",
        "pantalla-03c-24-error-tecnico-aprobada-final",
        "pantalla-03c-25-bloqueo-temporal-5-minutos-aprobada-final",
        "pantalla-03c-resumen-26-estados-aprobada-final"
      ]
    },
    {
      "screen_code": "03D",
      "title": "Datos personales extraídos",
      "stage": 3,
      "status": "approved",
      "purpose": "Revisar, completar y corregir los datos extraídos de la cédula; registrar cualquier modificación.",
      "primary_action": "Validar datos y continuar",
      "linked_spec": "data/PANTALLA_03D_ESPECIFICACION_Y_CATALOGOS_APROBADA_FINAL.json",
      "approved_runtime_views": 14,
      "candidate_views": 0,
      "artifacts": [
        "pantalla-03d-00-datos-extraidos-campos-pendientes-aprobada-final",
        "pantalla-03d-01-menu-sexo-aprobada-final",
        "pantalla-03d-02-menu-estado-civil-aprobada-final",
        "pantalla-03d-03-menu-pais-nacimiento-aprobada-final",
        "pantalla-03d-04-menu-nacionalidad-aprobada-final",
        "pantalla-03d-05-menu-pais-residencia-aprobada-final",
        "pantalla-03d-06-menu-ciudad-aprobada-final",
        "pantalla-03d-07-todos-los-datos-completos-aprobada-final",
        "pantalla-03d-08-editando-dato-extraido-aprobada-final",
        "pantalla-03d-09-cambio-registrado-aprobada-final",
        "pantalla-03d-10-campo-obligatorio-faltante-aprobada-final",
        "pantalla-03d-11-fecha-nacimiento-invalida-aprobada-final",
        "pantalla-03d-12-validando-datos-aprobada-final",
        "pantalla-03d-13-no-elegible-por-edad-aprobada-final",
        "pantalla-03d-resumen-14-estados-aprobada-final"
      ]
    },
    {
      "screen_code": "03E",
      "title": "Actividad e ingresos",
      "stage": 3,
      "status": "candidate",
      "purpose": "Recopilar situación laboral, actividad, profesión, ocupación, empresa, ingreso, origen y condición PEP.",
      "primary_action": "Continuar",
      "approved_runtime_views": 0,
      "candidate_views": 20,
      "artifacts": [
        "pantalla-03e-00-inicial-candidata",
        "pantalla-03e-01-menu-situacion-laboral-candidata",
        "pantalla-03e-02-empleado-empresa-habilitada-candidata",
        "pantalla-03e-03-propietario-empresa-habilitada-candidata",
        "pantalla-03e-04-estudiante-autocompletado-candidata",
        "pantalla-03e-05-desempleado-autocompletado-candidata",
        "pantalla-03e-06-trabajador-hogar-autocompletado-candidata",
        "pantalla-03e-07-jubilado-autocompletado-candidata",
        "pantalla-03e-08-menu-actividad-economica-candidata",
        "pantalla-03e-09-menu-ocupacion-oficio-candidata",
        "pantalla-03e-10-menu-profesion-candidata",
        "pantalla-03e-11-menu-origen-ingresos-candidata",
        "pantalla-03e-13-datos-completos-pep-pendiente-candidata",
        "pantalla-03e-14-lista-pep-no-candidata",
        "pantalla-03e-15-lista-pep-si-candidata",
        "pantalla-03e-16-campo-obligatorio-faltante-candidata",
        "pantalla-03e-17-empresa-condicional-faltante-candidata",
        "pantalla-03e-18-ingreso-no-valido-candidata",
        "pantalla-03e-19-validando-pep-no-candidata",
        "pantalla-03e-20-registrando-revision-pep-si-candidata"
      ]
    },
    {
      "screen_code": "03E1",
      "title": "Ayuda: qué significa PEP",
      "stage": 3,
      "status": "candidate",
      "purpose": "Explicar el concepto PEP antes de responder.",
      "primary_action": "Cerrar ayuda",
      "approved_runtime_views": 0,
      "candidate_views": 1,
      "artifacts": [
        "pantalla-03e1-12-que-significa-pep-candidata"
      ]
    },
    {
      "screen_code": "03E2",
      "title": "Revisión manual por condición PEP",
      "stage": 4,
      "status": "approved",
      "purpose": "Confirmar que el caso PEP fue registrado para evaluación manual sin firma ni cobro.",
      "primary_action": "Cerrar sesión",
      "approved_runtime_views": 1,
      "candidate_views": 0,
      "artifacts": [
        "pantalla-03e2-21-revision-manual-registrada-aprobada-final"
      ]
    },
    {
      "screen_code": "03E2A",
      "title": "Confirmación de cierre de sesión",
      "stage": 4,
      "status": "approved",
      "purpose": "Confirmar el cierre cuando la solicitud ya quedó registrada para revisión.",
      "primary_action": "Cerrar sesión",
      "approved_runtime_views": 1,
      "candidate_views": 0,
      "artifacts": [
        "pantalla-03e2a-22-confirmar-cierre-sesion-aprobada-final"
      ]
    },
    {
      "screen_code": "03E2B",
      "title": "Error al registrar revisión",
      "stage": 4,
      "status": "approved",
      "purpose": "Informar que no se creó caso, firma ni cobro y permitir reiniciar la contratación.",
      "primary_action": "Iniciar nueva contratación",
      "approved_runtime_views": 1,
      "candidate_views": 0,
      "artifacts": [
        "pantalla-03e2b-22-error-registro-revision-aprobada-final"
      ]
    },
    {
      "screen_code": "04A",
      "title": "Datos y declaraciones",
      "stage": 4,
      "status": "approved",
      "purpose": "Recoger tres declaraciones de salud y los datos del beneficiario por fallecimiento.",
      "primary_action": "Continuar",
      "approved_runtime_views": 1,
      "candidate_views": 0,
      "artifacts": [
        "pantalla-04a-00-datos-y-declaraciones-aprobada-final"
      ]
    },
    {
      "screen_code": "04A1",
      "title": "Evaluación manual médica",
      "stage": 4,
      "status": "approved",
      "purpose": "Detener el flujo automático y registrar evaluación adicional por salud o antecedentes, sin rechazo automático.",
      "primary_action": "Cerrar sesión",
      "approved_runtime_views": 1,
      "candidate_views": 0,
      "artifacts": [
        "pantalla-04a1-00-evaluacion-manual-medica-aprobada-final"
      ]
    },
    {
      "screen_code": "04D",
      "title": "Consentimientos",
      "stage": 4,
      "status": "approved",
      "purpose": "Registrar entrega digital, inicio de cobertura y carencias, e intervención del corredor.",
      "primary_action": "Continuar",
      "approved_runtime_views": 1,
      "candidate_views": 0,
      "artifacts": [
        "pantalla-04d-00-consentimientos-aprobada-final"
      ]
    }
  ],
  "screens": [
    {
      "id": "pantalla-01-aprobada-final",
      "screen_code": "01",
      "state_code": "portada-y-catalogo-de-productos",
      "title": "Portada y catálogo de productos",
      "group_title": "Portada y catálogo de productos",
      "main_stage": 1,
      "approval_status": "APROBADA_FINAL",
      "approved_for_development": true,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/aprobadas/PANTALLA_01_APROBADA_FINAL.png",
      "original_filename": "PANTALLA_01_APROBADA_FINAL.png",
      "image": {
        "width": 1103,
        "height": 1426,
        "sha256": "f4d79d95ede05a2608982bf8a80a24fa9d54670ee4d7fdc846836453f28a0832",
        "size_bytes": 1392272
      }
    },
    {
      "id": "pantalla-01-caratula-catalogo-candidata",
      "screen_code": "01",
      "state_code": "caratula-catalogo",
      "title": "Caratula catalogo",
      "group_title": "Portada y catálogo de productos",
      "main_stage": 1,
      "approval_status": "CANDIDATA",
      "approved_for_development": false,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/candidatas/PANTALLA_01_CARATULA_CATALOGO_CANDIDATA.png",
      "original_filename": "PANTALLA_01_CARATULA_CATALOGO_CANDIDATA.png",
      "image": {
        "width": 1103,
        "height": 1426,
        "sha256": "1560775aba1ca83ea770edcffee990045e763c6d21e50449dc5e6b62b636c032",
        "size_bytes": 1566334
      }
    },
    {
      "id": "pantalla-01a-detalle-cookies-aprobada-final",
      "screen_code": "01A",
      "state_code": "detalle-cookies",
      "title": "Detalle cookies",
      "group_title": "Detalle de cookies",
      "main_stage": 1,
      "approval_status": "APROBADA_FINAL",
      "approved_for_development": true,
      "artifact_type": "detail_view",
      "reference_image": "assets/screens/aprobadas/PANTALLA_01A_DETALLE_COOKIES_APROBADA_FINAL.png",
      "original_filename": "PANTALLA_01A_DETALLE_COOKIES_APROBADA_FINAL.png",
      "image": {
        "width": 1103,
        "height": 1426,
        "sha256": "707f9e96cf2437dcf318b3a192125dd753464748c9693ac08a563816eab78804",
        "size_bytes": 1190404
      }
    },
    {
      "id": "pantalla-01b-confirmacion-salida-aprobada-final",
      "screen_code": "01B",
      "state_code": "confirmacion-salida",
      "title": "Confirmacion salida",
      "group_title": "Menú y confirmación de salida",
      "main_stage": 1,
      "approval_status": "APROBADA_FINAL",
      "approved_for_development": true,
      "artifact_type": "modal",
      "reference_image": "assets/screens/aprobadas/PANTALLA_01B_CONFIRMACION_SALIDA_APROBADA_FINAL.png",
      "original_filename": "PANTALLA_01B_CONFIRMACION_SALIDA_APROBADA_FINAL.png",
      "image": {
        "width": 1103,
        "height": 1426,
        "sha256": "d6ef362ed0de74d9e35a2c30f07bb4f755e7864ea14d1537368c1800fe1567af",
        "size_bytes": 1230071
      }
    },
    {
      "id": "pantalla-01b-menu-aprobada-final",
      "screen_code": "01B",
      "state_code": "menu",
      "title": "Menu",
      "group_title": "Menú y confirmación de salida",
      "main_stage": 1,
      "approval_status": "APROBADA_FINAL",
      "approved_for_development": true,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/aprobadas/PANTALLA_01B_MENU_APROBADA_FINAL.png",
      "original_filename": "PANTALLA_01B_MENU_APROBADA_FINAL.png",
      "image": {
        "width": 1103,
        "height": 1426,
        "sha256": "7c51c0a0428ebc8850901012dedee7d1f669a135d1487752f7fbf2bffd5c2d1d",
        "size_bytes": 951117
      }
    },
    {
      "id": "pantalla-01c-responsabilidades-aprobada-final",
      "screen_code": "01C",
      "state_code": "responsabilidades",
      "title": "Responsabilidades",
      "group_title": "Responsabilidades institucionales",
      "main_stage": 1,
      "approval_status": "APROBADA_FINAL",
      "approved_for_development": true,
      "artifact_type": "detail_view",
      "reference_image": "assets/screens/aprobadas/PANTALLA_01C_RESPONSABILIDADES_APROBADA_FINAL.png",
      "original_filename": "PANTALLA_01C_RESPONSABILIDADES_APROBADA_FINAL.png",
      "image": {
        "width": 1103,
        "height": 1426,
        "sha256": "eb1e5049ecdad92b3e8eb064756fec48486402dcb907f73f5e604d4af9aa9c24",
        "size_bytes": 1105711
      }
    },
    {
      "id": "pantalla-01d-contacto-aprobada-final",
      "screen_code": "01D",
      "state_code": "contacto",
      "title": "Contacto",
      "group_title": "Contacto",
      "main_stage": 1,
      "approval_status": "APROBADA_FINAL",
      "approved_for_development": true,
      "artifact_type": "detail_view",
      "reference_image": "assets/screens/aprobadas/PANTALLA_01D_CONTACTO_APROBADA_FINAL.png",
      "original_filename": "PANTALLA_01D_CONTACTO_APROBADA_FINAL.png",
      "image": {
        "width": 1103,
        "height": 1426,
        "sha256": "f83447ccfadbc2c850c0883bab0b7f8b452a45d946eeda96896a8b0e3d398632",
        "size_bytes": 1303221
      }
    },
    {
      "id": "pantalla-01e-informacion-legal-aprobada-final",
      "screen_code": "01E",
      "state_code": "informacion-legal",
      "title": "Informacion legal",
      "group_title": "Información legal",
      "main_stage": 1,
      "approval_status": "APROBADA_FINAL",
      "approved_for_development": true,
      "artifact_type": "detail_view",
      "reference_image": "assets/screens/aprobadas/PANTALLA_01E_INFORMACION_LEGAL_APROBADA_FINAL.png",
      "original_filename": "PANTALLA_01E_INFORMACION_LEGAL_APROBADA_FINAL.png",
      "image": {
        "width": 1103,
        "height": 1426,
        "sha256": "7f4136a6dfc5cde311d9d2a5afed39f15e9b7bf09c2fbab592a2915c9782909c",
        "size_bytes": 1268317
      }
    },
    {
      "id": "pantalla-02-seleccion-plan-aprobada-final",
      "screen_code": "02",
      "state_code": "seleccion-plan",
      "title": "Seleccion plan",
      "group_title": "Selección de plan",
      "main_stage": 2,
      "approval_status": "APROBADA_FINAL",
      "approved_for_development": true,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/aprobadas/PANTALLA_02_SELECCION_PLAN_APROBADA_FINAL.png",
      "original_filename": "PANTALLA_02_SELECCION_PLAN_APROBADA_FINAL.png",
      "image": {
        "width": 1103,
        "height": 1426,
        "sha256": "11fea2c6c28a943d479d5f9400efa887825ff315f11e8ce39a0728eec94e62df",
        "size_bytes": 1303887
      }
    },
    {
      "id": "pantalla-02a-coberturas-aprobada-final",
      "screen_code": "02A",
      "state_code": "coberturas",
      "title": "Coberturas",
      "group_title": "Coberturas",
      "main_stage": 2,
      "approval_status": "APROBADA_FINAL",
      "approved_for_development": true,
      "artifact_type": "detail_view",
      "reference_image": "assets/screens/aprobadas/PANTALLA_02A_COBERTURAS_APROBADA_FINAL.png",
      "original_filename": "PANTALLA_02A_COBERTURAS_APROBADA_FINAL.png",
      "image": {
        "width": 1103,
        "height": 1426,
        "sha256": "d9c9625e3a1d2f0f94dfa5d2cf3862f06293bd5c673e455f3bdc553d20953105",
        "size_bytes": 1284287
      }
    },
    {
      "id": "pantalla-02b-exclusiones-aprobada-final",
      "screen_code": "02B",
      "state_code": "exclusiones",
      "title": "Exclusiones",
      "group_title": "Exclusiones",
      "main_stage": 2,
      "approval_status": "APROBADA_FINAL",
      "approved_for_development": true,
      "artifact_type": "detail_view",
      "reference_image": "assets/screens/aprobadas/PANTALLA_02B_EXCLUSIONES_APROBADA_FINAL.png",
      "original_filename": "PANTALLA_02B_EXCLUSIONES_APROBADA_FINAL.png",
      "image": {
        "width": 858,
        "height": 1832,
        "sha256": "cca4742583d4aa37bd2f271e8da8a1322a6325f74200ab9dc6ca7790a72bce6c",
        "size_bytes": 1607693
      }
    },
    {
      "id": "pantalla-02c-siniestros-aprobada-final",
      "screen_code": "02C",
      "state_code": "siniestros",
      "title": "Siniestros",
      "group_title": "Siniestros",
      "main_stage": 2,
      "approval_status": "APROBADA_FINAL",
      "approved_for_development": true,
      "artifact_type": "detail_view",
      "reference_image": "assets/screens/aprobadas/PANTALLA_02C_SINIESTROS_APROBADA_FINAL.png",
      "original_filename": "PANTALLA_02C_SINIESTROS_APROBADA_FINAL.png",
      "image": {
        "width": 858,
        "height": 1832,
        "sha256": "756d35ed741437d5085238bf642301af2c5523478ede18ca77fb7002e8564bdf",
        "size_bytes": 1443970
      }
    },
    {
      "id": "pantalla-03a-00-verificacion-whatsapp-estado-inicial-aprobada-final",
      "screen_code": "03A",
      "state_code": "00",
      "title": "Verificacion WhatsApp estado inicial",
      "group_title": "Verificación de WhatsApp",
      "main_stage": 3,
      "approval_status": "APROBADA_FINAL",
      "approved_for_development": true,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/aprobadas/PANTALLA_03A_00_VERIFICACION_WHATSAPP_ESTADO_INICIAL_APROBADA_FINAL.png",
      "original_filename": "PANTALLA_03A_00_VERIFICACION_WHATSAPP_ESTADO_INICIAL_APROBADA_FINAL.png",
      "image": {
        "width": 941,
        "height": 1671,
        "sha256": "013b7fd6ec63bd3cf6a78b9ecebd69cf9c82140745373619e8591cd5e1e638c9",
        "size_bytes": 1506844
      }
    },
    {
      "id": "pantalla-03a-01a-autorizacion-pendiente-aprobada-final",
      "screen_code": "03A",
      "state_code": "01A",
      "title": "Autorizacion pendiente",
      "group_title": "Verificación de WhatsApp",
      "main_stage": 3,
      "approval_status": "APROBADA_FINAL",
      "approved_for_development": true,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/aprobadas/PANTALLA_03A_01A_AUTORIZACION_PENDIENTE_APROBADA_FINAL.png",
      "original_filename": "PANTALLA_03A_01A_AUTORIZACION_PENDIENTE_APROBADA_FINAL.png",
      "image": {
        "width": 941,
        "height": 1671,
        "sha256": "dea697594ae87da6d777606c7819f8b094abf8c1ab2bb703dc5148380f442520",
        "size_bytes": 1499765
      }
    },
    {
      "id": "pantalla-03a-01b-numero-invalido-aprobada-final",
      "screen_code": "03A",
      "state_code": "01B",
      "title": "Numero invalido",
      "group_title": "Verificación de WhatsApp",
      "main_stage": 3,
      "approval_status": "APROBADA_FINAL",
      "approved_for_development": true,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/aprobadas/PANTALLA_03A_01B_NUMERO_INVALIDO_APROBADA_FINAL.png",
      "original_filename": "PANTALLA_03A_01B_NUMERO_INVALIDO_APROBADA_FINAL.png",
      "image": {
        "width": 941,
        "height": 1671,
        "sha256": "eecd0386af644c9a60de6b2a514f087f98bc67ec142b3215ae35f2e514a17576",
        "size_bytes": 1547274
      }
    },
    {
      "id": "pantalla-03a-01-datos-listos-para-envio-aprobada-final",
      "screen_code": "03A",
      "state_code": "01",
      "title": "Datos listos para envio",
      "group_title": "Verificación de WhatsApp",
      "main_stage": 3,
      "approval_status": "APROBADA_FINAL",
      "approved_for_development": true,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/aprobadas/PANTALLA_03A_01_DATOS_LISTOS_PARA_ENVIO_APROBADA_FINAL.png",
      "original_filename": "PANTALLA_03A_01_DATOS_LISTOS_PARA_ENVIO_APROBADA_FINAL.png",
      "image": {
        "width": 941,
        "height": 1671,
        "sha256": "9da3673b0f15210614291b79dedc5108e317ab3273e949a9e6bf84620444bb25",
        "size_bytes": 1517858
      }
    },
    {
      "id": "pantalla-03a-02-enviando-codigo-aprobada-final",
      "screen_code": "03A",
      "state_code": "02",
      "title": "Enviando codigo",
      "group_title": "Verificación de WhatsApp",
      "main_stage": 3,
      "approval_status": "APROBADA_FINAL",
      "approved_for_development": true,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/aprobadas/PANTALLA_03A_02_ENVIANDO_CODIGO_APROBADA_FINAL.png",
      "original_filename": "PANTALLA_03A_02_ENVIANDO_CODIGO_APROBADA_FINAL.png",
      "image": {
        "width": 941,
        "height": 1671,
        "sha256": "9e04e16a5b20219776de575c69baf512d1cc3d34ef253b240e014eac05dd6dc8",
        "size_bytes": 1477567
      }
    },
    {
      "id": "pantalla-03a-03-codigo-whatsapp-enviado-aprobada-final",
      "screen_code": "03A",
      "state_code": "03",
      "title": "Codigo WhatsApp enviado",
      "group_title": "Verificación de WhatsApp",
      "main_stage": 3,
      "approval_status": "APROBADA_FINAL",
      "approved_for_development": true,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/aprobadas/PANTALLA_03A_03_CODIGO_WHATSAPP_ENVIADO_APROBADA_FINAL.png",
      "original_filename": "PANTALLA_03A_03_CODIGO_WHATSAPP_ENVIADO_APROBADA_FINAL.png",
      "image": {
        "width": 941,
        "height": 1671,
        "sha256": "23c0346f70ec64e3977fcd34d1bd0cc67a68a2b99a61ffb80006f0b6354377eb",
        "size_bytes": 1500703
      }
    },
    {
      "id": "pantalla-03a-04-otp-completo-aprobada-final",
      "screen_code": "03A",
      "state_code": "04",
      "title": "OTP completo",
      "group_title": "Verificación de WhatsApp",
      "main_stage": 3,
      "approval_status": "APROBADA_FINAL",
      "approved_for_development": true,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/aprobadas/PANTALLA_03A_04_OTP_COMPLETO_APROBADA_FINAL.png",
      "original_filename": "PANTALLA_03A_04_OTP_COMPLETO_APROBADA_FINAL.png",
      "image": {
        "width": 941,
        "height": 1671,
        "sha256": "51943f46180f484632f62937ad0a9e65bdc713eb5c3a4bdf4dbaf7109b447304",
        "size_bytes": 1579203
      }
    },
    {
      "id": "pantalla-03a-05-verificando-otp-aprobada-final",
      "screen_code": "03A",
      "state_code": "05",
      "title": "Verificando OTP",
      "group_title": "Verificación de WhatsApp",
      "main_stage": 3,
      "approval_status": "APROBADA_FINAL",
      "approved_for_development": true,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/aprobadas/PANTALLA_03A_05_VERIFICANDO_OTP_APROBADA_FINAL.png",
      "original_filename": "PANTALLA_03A_05_VERIFICANDO_OTP_APROBADA_FINAL.png",
      "image": {
        "width": 941,
        "height": 1671,
        "sha256": "7be2640b4ac7e479efffe7b6e5486ad7f3f658adfec81980537f516427cd95ec",
        "size_bytes": 1569954
      }
    },
    {
      "id": "pantalla-03a-06-codigo-incorrecto-aprobada-final",
      "screen_code": "03A",
      "state_code": "06",
      "title": "Codigo incorrecto",
      "group_title": "Verificación de WhatsApp",
      "main_stage": 3,
      "approval_status": "APROBADA_FINAL",
      "approved_for_development": true,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/aprobadas/PANTALLA_03A_06_CODIGO_INCORRECTO_APROBADA_FINAL.png",
      "original_filename": "PANTALLA_03A_06_CODIGO_INCORRECTO_APROBADA_FINAL.png",
      "image": {
        "width": 941,
        "height": 1671,
        "sha256": "14c10c33072ec56c58d402458820b41d786c24863dbee4cfe86d1415389895c7",
        "size_bytes": 1537326
      }
    },
    {
      "id": "pantalla-03a-07-codigo-invalidado-tercer-intento-aprobada-final",
      "screen_code": "03A",
      "state_code": "07",
      "title": "Codigo invalidado tercer intento",
      "group_title": "Verificación de WhatsApp",
      "main_stage": 3,
      "approval_status": "APROBADA_FINAL",
      "approved_for_development": true,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/aprobadas/PANTALLA_03A_07_CODIGO_INVALIDADO_TERCER_INTENTO_APROBADA_FINAL.png",
      "original_filename": "PANTALLA_03A_07_CODIGO_INVALIDADO_TERCER_INTENTO_APROBADA_FINAL.png",
      "image": {
        "width": 941,
        "height": 1671,
        "sha256": "2177f462628b9f5975cabfa86fb3fd4a614c69a6f9d45ab6d3cf3576d86c15d3",
        "size_bytes": 1562285
      }
    },
    {
      "id": "pantalla-03a-08-reenvio-whatsapp-realizado-aprobada-final",
      "screen_code": "03A",
      "state_code": "08",
      "title": "Reenvio WhatsApp realizado",
      "group_title": "Verificación de WhatsApp",
      "main_stage": 3,
      "approval_status": "APROBADA_FINAL",
      "approved_for_development": true,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/aprobadas/PANTALLA_03A_08_REENVIO_WHATSAPP_REALIZADO_APROBADA_FINAL.png",
      "original_filename": "PANTALLA_03A_08_REENVIO_WHATSAPP_REALIZADO_APROBADA_FINAL.png",
      "image": {
        "width": 941,
        "height": 1671,
        "sha256": "50f8980f3d21e34268c2ca90e154defc4c73df995a1242b5972047f071709ff2",
        "size_bytes": 1545350
      }
    },
    {
      "id": "pantalla-03a-09-codigo-whatsapp-vencido-aprobada-final",
      "screen_code": "03A",
      "state_code": "09",
      "title": "Codigo WhatsApp vencido",
      "group_title": "Verificación de WhatsApp",
      "main_stage": 3,
      "approval_status": "APROBADA_FINAL",
      "approved_for_development": true,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/aprobadas/PANTALLA_03A_09_CODIGO_WHATSAPP_VENCIDO_APROBADA_FINAL.png",
      "original_filename": "PANTALLA_03A_09_CODIGO_WHATSAPP_VENCIDO_APROBADA_FINAL.png",
      "image": {
        "width": 941,
        "height": 1671,
        "sha256": "7a206bdc1282f458036d1c00b3b09d94466a93ac6882278c594765604bedf05d",
        "size_bytes": 1553787
      }
    },
    {
      "id": "pantalla-03a-10-sms-disponible-aprobada-final",
      "screen_code": "03A",
      "state_code": "10",
      "title": "SMS disponible",
      "group_title": "Verificación de WhatsApp",
      "main_stage": 3,
      "approval_status": "APROBADA_FINAL",
      "approved_for_development": true,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/aprobadas/PANTALLA_03A_10_SMS_DISPONIBLE_APROBADA_FINAL.png",
      "original_filename": "PANTALLA_03A_10_SMS_DISPONIBLE_APROBADA_FINAL.png",
      "image": {
        "width": 941,
        "height": 1671,
        "sha256": "a3cca303158c7f52dbd6d4cabee57e7fec5101c590f29b9edf3b2135a9ccc5fd",
        "size_bytes": 1524438
      }
    },
    {
      "id": "pantalla-03a-11-codigo-sms-enviado-aprobada-final",
      "screen_code": "03A",
      "state_code": "11",
      "title": "Codigo SMS enviado",
      "group_title": "Verificación de WhatsApp",
      "main_stage": 3,
      "approval_status": "APROBADA_FINAL",
      "approved_for_development": true,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/aprobadas/PANTALLA_03A_11_CODIGO_SMS_ENVIADO_APROBADA_FINAL.png",
      "original_filename": "PANTALLA_03A_11_CODIGO_SMS_ENVIADO_APROBADA_FINAL.png",
      "image": {
        "width": 941,
        "height": 1671,
        "sha256": "5833046c7ea7c5617c9dc2b84e03473831aafca1fb4a4a819de3cce659c26b6d",
        "size_bytes": 1538228
      }
    },
    {
      "id": "pantalla-03a-12-bloqueo-temporal-aprobada-final",
      "screen_code": "03A",
      "state_code": "12",
      "title": "Bloqueo temporal",
      "group_title": "Verificación de WhatsApp",
      "main_stage": 3,
      "approval_status": "APROBADA_FINAL",
      "approved_for_development": true,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/aprobadas/PANTALLA_03A_12_BLOQUEO_TEMPORAL_APROBADA_FINAL.png",
      "original_filename": "PANTALLA_03A_12_BLOQUEO_TEMPORAL_APROBADA_FINAL.png",
      "image": {
        "width": 941,
        "height": 1671,
        "sha256": "515dab808340c41e651db40dbe2991bd14c61e8691a383c19684bc2b8b789f4f",
        "size_bytes": 1503459
      }
    },
    {
      "id": "pantalla-03a-13-error-tecnico-envio-aprobada-final",
      "screen_code": "03A",
      "state_code": "13",
      "title": "Error tecnico envio",
      "group_title": "Verificación de WhatsApp",
      "main_stage": 3,
      "approval_status": "APROBADA_FINAL",
      "approved_for_development": true,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/aprobadas/PANTALLA_03A_13_ERROR_TECNICO_ENVIO_APROBADA_FINAL.png",
      "original_filename": "PANTALLA_03A_13_ERROR_TECNICO_ENVIO_APROBADA_FINAL.png",
      "image": {
        "width": 941,
        "height": 1671,
        "sha256": "4895058b0ee99f7427bb75e03ab37ed5942ee0a6fe6a6ef4b55f8548ef91acbd",
        "size_bytes": 1546316
      }
    },
    {
      "id": "pantalla-03a-14-numero-sin-whatsapp-aprobada-final",
      "screen_code": "03A",
      "state_code": "14",
      "title": "Numero sin WhatsApp",
      "group_title": "Verificación de WhatsApp",
      "main_stage": 3,
      "approval_status": "APROBADA_FINAL",
      "approved_for_development": true,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/aprobadas/PANTALLA_03A_14_NUMERO_SIN_WHATSAPP_APROBADA_FINAL.png",
      "original_filename": "PANTALLA_03A_14_NUMERO_SIN_WHATSAPP_APROBADA_FINAL.png",
      "image": {
        "width": 941,
        "height": 1671,
        "sha256": "644b8a8a76b012c6ae687ac2d7d2d035b01a9d14042142b824c35520133e8e08",
        "size_bytes": 1537826
      }
    },
    {
      "id": "pantalla-03a-15-verificacion-exitosa-aprobada-final",
      "screen_code": "03A",
      "state_code": "15",
      "title": "Verificacion exitosa",
      "group_title": "Verificación de WhatsApp",
      "main_stage": 3,
      "approval_status": "APROBADA_FINAL",
      "approved_for_development": true,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/aprobadas/PANTALLA_03A_15_VERIFICACION_EXITOSA_APROBADA_FINAL.png",
      "original_filename": "PANTALLA_03A_15_VERIFICACION_EXITOSA_APROBADA_FINAL.png",
      "image": {
        "width": 941,
        "height": 1671,
        "sha256": "6730747cbd5120081c23bca85a0db608f1716f02dd3e4225ab66087c7ba6c0ef",
        "size_bytes": 1524059
      }
    },
    {
      "id": "pantalla-03b-00-prepare-lo-necesario-estado-inicial-aprobada-final",
      "screen_code": "03B",
      "state_code": "00",
      "title": "Prepare lo necesario estado inicial",
      "group_title": "Preparación y aviso de privacidad",
      "main_stage": 3,
      "approval_status": "APROBADA_FINAL",
      "approved_for_development": true,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/aprobadas/PANTALLA_03B_00_PREPARE_LO_NECESARIO_ESTADO_INICIAL_APROBADA_FINAL.png",
      "original_filename": "PANTALLA_03B_00_PREPARE_LO_NECESARIO_ESTADO_INICIAL_APROBADA_FINAL.png",
      "image": {
        "width": 941,
        "height": 1671,
        "sha256": "38d0aa03a29d5400d6dfdc3a7a7dcbf214d3ed3a5e45bc3c9ae1b3b7ddd0c0e1",
        "size_bytes": 472522
      }
    },
    {
      "id": "pantalla-03b-01-prepare-lo-necesario-listo-aprobada-final",
      "screen_code": "03B",
      "state_code": "01",
      "title": "Prepare lo necesario listo",
      "group_title": "Preparación y aviso de privacidad",
      "main_stage": 3,
      "approval_status": "APROBADA_FINAL",
      "approved_for_development": true,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/aprobadas/PANTALLA_03B_01_PREPARE_LO_NECESARIO_LISTO_APROBADA_FINAL.png",
      "original_filename": "PANTALLA_03B_01_PREPARE_LO_NECESARIO_LISTO_APROBADA_FINAL.png",
      "image": {
        "width": 941,
        "height": 1671,
        "sha256": "62aafb1133e06f2af2ca21483dfa6f858667c753c2af97674f9ba8bc044acf24",
        "size_bytes": 473317
      }
    },
    {
      "id": "pantalla-03b-02a-aviso-privacidad-unificado-inicio-aprobada-final",
      "screen_code": "03B",
      "state_code": "02A",
      "title": "Aviso privacidad unificado inicio",
      "group_title": "Preparación y aviso de privacidad",
      "main_stage": 3,
      "approval_status": "APROBADA_FINAL",
      "approved_for_development": true,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/aprobadas/PANTALLA_03B_02A_AVISO_PRIVACIDAD_UNIFICADO_INICIO_APROBADA_FINAL.png",
      "original_filename": "PANTALLA_03B_02A_AVISO_PRIVACIDAD_UNIFICADO_INICIO_APROBADA_FINAL.png",
      "image": {
        "width": 941,
        "height": 1671,
        "sha256": "d162fdc58345d486c8b1f74688c542f10fa2ed08316a57600e44d3638dee752a",
        "size_bytes": 400507
      }
    },
    {
      "id": "pantalla-03b-02b-aviso-privacidad-unificado-final-aprobada-final",
      "screen_code": "03B",
      "state_code": "02B",
      "title": "Aviso privacidad unificado final",
      "group_title": "Preparación y aviso de privacidad",
      "main_stage": 3,
      "approval_status": "APROBADA_FINAL",
      "approved_for_development": true,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/aprobadas/PANTALLA_03B_02B_AVISO_PRIVACIDAD_UNIFICADO_FINAL_APROBADA_FINAL.png",
      "original_filename": "PANTALLA_03B_02B_AVISO_PRIVACIDAD_UNIFICADO_FINAL_APROBADA_FINAL.png",
      "image": {
        "width": 941,
        "height": 1671,
        "sha256": "9d85f36abd64a07bade02997ed46c4011521e4d51d46e9b7927bc7fab1d7741c",
        "size_bytes": 397742
      }
    },
    {
      "id": "pantalla-03c-00-estado-inicial-aprobada-final",
      "screen_code": "03C",
      "state_code": "00",
      "title": "Estado inicial",
      "group_title": "Captura y validación de identidad",
      "main_stage": 3,
      "approval_status": "APROBADA_FINAL",
      "approved_for_development": true,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/aprobadas/PANTALLA_03C_00_ESTADO_INICIAL_APROBADA_FINAL.png",
      "original_filename": "PANTALLA_03C_00_ESTADO_INICIAL_APROBADA_FINAL.png",
      "image": {
        "width": 941,
        "height": 1671,
        "sha256": "378d10c98d1cf3a997e9867e2645f0f4f13ec58c7f3913b2f870bb5a501b4f88",
        "size_bytes": 476681
      }
    },
    {
      "id": "pantalla-03c-01-camara-frente-aprobada-final",
      "screen_code": "03C",
      "state_code": "01",
      "title": "Camara frente",
      "group_title": "Captura y validación de identidad",
      "main_stage": 3,
      "approval_status": "APROBADA_FINAL",
      "approved_for_development": true,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/aprobadas/PANTALLA_03C_01_CAMARA_FRENTE_APROBADA_FINAL.png",
      "original_filename": "PANTALLA_03C_01_CAMARA_FRENTE_APROBADA_FINAL.png",
      "image": {
        "width": 941,
        "height": 1671,
        "sha256": "16e564c3f8a9dee96d1ca9d58e3f58a420f80fe99bf12ccf4059731ff412b224",
        "size_bytes": 276735
      }
    },
    {
      "id": "pantalla-03c-02-frente-procesando-aprobada-final",
      "screen_code": "03C",
      "state_code": "02",
      "title": "Frente procesando",
      "group_title": "Captura y validación de identidad",
      "main_stage": 3,
      "approval_status": "APROBADA_FINAL",
      "approved_for_development": true,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/aprobadas/PANTALLA_03C_02_FRENTE_PROCESANDO_APROBADA_FINAL.png",
      "original_filename": "PANTALLA_03C_02_FRENTE_PROCESANDO_APROBADA_FINAL.png",
      "image": {
        "width": 941,
        "height": 1671,
        "sha256": "b79d17ad6ef7a78c3c6031c11dee1a2888ea1f074139dc881a16cf6209e45c97",
        "size_bytes": 473643
      }
    },
    {
      "id": "pantalla-03c-03-frente-validado-dorso-habilitado-aprobada-final",
      "screen_code": "03C",
      "state_code": "03",
      "title": "Frente validado dorso habilitado",
      "group_title": "Captura y validación de identidad",
      "main_stage": 3,
      "approval_status": "APROBADA_FINAL",
      "approved_for_development": true,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/aprobadas/PANTALLA_03C_03_FRENTE_VALIDADO_DORSO_HABILITADO_APROBADA_FINAL.png",
      "original_filename": "PANTALLA_03C_03_FRENTE_VALIDADO_DORSO_HABILITADO_APROBADA_FINAL.png",
      "image": {
        "width": 941,
        "height": 1671,
        "sha256": "a66957d09756d5dd330fb972f40ea0fc97182c738043808aaadf484de5b71aa6",
        "size_bytes": 478397
      }
    },
    {
      "id": "pantalla-03c-04-camara-dorso-aprobada-final",
      "screen_code": "03C",
      "state_code": "04",
      "title": "Camara dorso",
      "group_title": "Captura y validación de identidad",
      "main_stage": 3,
      "approval_status": "APROBADA_FINAL",
      "approved_for_development": true,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/aprobadas/PANTALLA_03C_04_CAMARA_DORSO_APROBADA_FINAL.png",
      "original_filename": "PANTALLA_03C_04_CAMARA_DORSO_APROBADA_FINAL.png",
      "image": {
        "width": 941,
        "height": 1671,
        "sha256": "b93287e4bdca1e5d0b4a1b1de26c69fd8e280d6d7c3585279802083ff1d7b912",
        "size_bytes": 276358
      }
    },
    {
      "id": "pantalla-03c-05-dorso-procesando-aprobada-final",
      "screen_code": "03C",
      "state_code": "05",
      "title": "Dorso procesando",
      "group_title": "Captura y validación de identidad",
      "main_stage": 3,
      "approval_status": "APROBADA_FINAL",
      "approved_for_development": true,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/aprobadas/PANTALLA_03C_05_DORSO_PROCESANDO_APROBADA_FINAL.png",
      "original_filename": "PANTALLA_03C_05_DORSO_PROCESANDO_APROBADA_FINAL.png",
      "image": {
        "width": 941,
        "height": 1671,
        "sha256": "c1eb79b3d09b96dcddda3662461b19b188a629b4bd66bc820221751667f9f441",
        "size_bytes": 475283
      }
    },
    {
      "id": "pantalla-03c-06-documento-validado-selfie-habilitada-aprobada-final",
      "screen_code": "03C",
      "state_code": "06",
      "title": "Documento validado selfie habilitada",
      "group_title": "Captura y validación de identidad",
      "main_stage": 3,
      "approval_status": "APROBADA_FINAL",
      "approved_for_development": true,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/aprobadas/PANTALLA_03C_06_DOCUMENTO_VALIDADO_SELFIE_HABILITADA_APROBADA_FINAL.png",
      "original_filename": "PANTALLA_03C_06_DOCUMENTO_VALIDADO_SELFIE_HABILITADA_APROBADA_FINAL.png",
      "image": {
        "width": 941,
        "height": 1671,
        "sha256": "2f6bf5a66c7efcd330ffd560b6e7a926c5abdec77f8ad8b65fbd26c7491986ef",
        "size_bytes": 473131
      }
    },
    {
      "id": "pantalla-03c-07-camara-selfie-aprobada-final",
      "screen_code": "03C",
      "state_code": "07",
      "title": "Camara selfie",
      "group_title": "Captura y validación de identidad",
      "main_stage": 3,
      "approval_status": "APROBADA_FINAL",
      "approved_for_development": true,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/aprobadas/PANTALLA_03C_07_CAMARA_SELFIE_APROBADA_FINAL.png",
      "original_filename": "PANTALLA_03C_07_CAMARA_SELFIE_APROBADA_FINAL.png",
      "image": {
        "width": 941,
        "height": 1671,
        "sha256": "937f4ac9eed8064f89d7cefbd999c0d5d20eb68e457d5b629e7284ed2d49f471",
        "size_bytes": 290428
      }
    },
    {
      "id": "pantalla-03c-08-selfie-procesando-aprobada-final",
      "screen_code": "03C",
      "state_code": "08",
      "title": "Selfie procesando",
      "group_title": "Captura y validación de identidad",
      "main_stage": 3,
      "approval_status": "APROBADA_FINAL",
      "approved_for_development": true,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/aprobadas/PANTALLA_03C_08_SELFIE_PROCESANDO_APROBADA_FINAL.png",
      "original_filename": "PANTALLA_03C_08_SELFIE_PROCESANDO_APROBADA_FINAL.png",
      "image": {
        "width": 941,
        "height": 1671,
        "sha256": "3769829e4eeeda64384e599584f3cac70a7380ae8c295868a468e5ee14ec3a8b",
        "size_bytes": 473274
      }
    },
    {
      "id": "pantalla-03c-09-identidad-validada-correo-habilitado-aprobada-final",
      "screen_code": "03C",
      "state_code": "09",
      "title": "Identidad validada correo habilitado",
      "group_title": "Captura y validación de identidad",
      "main_stage": 3,
      "approval_status": "APROBADA_FINAL",
      "approved_for_development": true,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/aprobadas/PANTALLA_03C_09_IDENTIDAD_VALIDADA_CORREO_HABILITADO_APROBADA_FINAL.png",
      "original_filename": "PANTALLA_03C_09_IDENTIDAD_VALIDADA_CORREO_HABILITADO_APROBADA_FINAL.png",
      "image": {
        "width": 941,
        "height": 1671,
        "sha256": "a55ccc2ec2c90ed908ea5386c504ca34aac6841d5997dbf5c1be130a6d330541",
        "size_bytes": 467266
      }
    },
    {
      "id": "pantalla-03c-10-correo-invalido-aprobada-final",
      "screen_code": "03C",
      "state_code": "10",
      "title": "Correo invalido",
      "group_title": "Captura y validación de identidad",
      "main_stage": 3,
      "approval_status": "APROBADA_FINAL",
      "approved_for_development": true,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/aprobadas/PANTALLA_03C_10_CORREO_INVALIDO_APROBADA_FINAL.png",
      "original_filename": "PANTALLA_03C_10_CORREO_INVALIDO_APROBADA_FINAL.png",
      "image": {
        "width": 941,
        "height": 1671,
        "sha256": "f00c6ece64f902bb5a5c42956ad0c00f014852dc504055d2a1eeee1aab549305",
        "size_bytes": 472867
      }
    },
    {
      "id": "pantalla-03c-11-correos-no-coinciden-aprobada-final",
      "screen_code": "03C",
      "state_code": "11",
      "title": "Correos no coinciden",
      "group_title": "Captura y validación de identidad",
      "main_stage": 3,
      "approval_status": "APROBADA_FINAL",
      "approved_for_development": true,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/aprobadas/PANTALLA_03C_11_CORREOS_NO_COINCIDEN_APROBADA_FINAL.png",
      "original_filename": "PANTALLA_03C_11_CORREOS_NO_COINCIDEN_APROBADA_FINAL.png",
      "image": {
        "width": 941,
        "height": 1671,
        "sha256": "f307630147c5a593ed8bff9925b473b35e702dc46418ceb58970bb014b62091b",
        "size_bytes": 476564
      }
    },
    {
      "id": "pantalla-03c-12-listo-para-validar-aprobada-final",
      "screen_code": "03C",
      "state_code": "12",
      "title": "Listo para validar",
      "group_title": "Captura y validación de identidad",
      "main_stage": 3,
      "approval_status": "APROBADA_FINAL",
      "approved_for_development": true,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/aprobadas/PANTALLA_03C_12_LISTO_PARA_VALIDAR_APROBADA_FINAL.png",
      "original_filename": "PANTALLA_03C_12_LISTO_PARA_VALIDAR_APROBADA_FINAL.png",
      "image": {
        "width": 941,
        "height": 1671,
        "sha256": "ebf607ddf69f1d2afad70f033f162fcce8d8b12d052a3b268e7073f87c146694",
        "size_bytes": 470249
      }
    },
    {
      "id": "pantalla-03c-13-validacion-final-procesando-aprobada-final",
      "screen_code": "03C",
      "state_code": "13",
      "title": "Validacion final procesando",
      "group_title": "Captura y validación de identidad",
      "main_stage": 3,
      "approval_status": "APROBADA_FINAL",
      "approved_for_development": true,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/aprobadas/PANTALLA_03C_13_VALIDACION_FINAL_PROCESANDO_APROBADA_FINAL.png",
      "original_filename": "PANTALLA_03C_13_VALIDACION_FINAL_PROCESANDO_APROBADA_FINAL.png",
      "image": {
        "width": 941,
        "height": 1671,
        "sha256": "b7ea2e371c54fb32c1aa92fa20da596d905eebfc759ea5bab4be33d4e5683bcc",
        "size_bytes": 469826
      }
    },
    {
      "id": "pantalla-03c-14-imagen-rechazada-calidad-aprobada-final",
      "screen_code": "03C",
      "state_code": "14",
      "title": "Imagen rechazada calidad",
      "group_title": "Captura y validación de identidad",
      "main_stage": 3,
      "approval_status": "APROBADA_FINAL",
      "approved_for_development": true,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/aprobadas/PANTALLA_03C_14_IMAGEN_RECHAZADA_CALIDAD_APROBADA_FINAL.png",
      "original_filename": "PANTALLA_03C_14_IMAGEN_RECHAZADA_CALIDAD_APROBADA_FINAL.png",
      "image": {
        "width": 941,
        "height": 1671,
        "sha256": "82df119e034c7e5abc80713ae920690a1f71276718df4532aac49cd0dc661358",
        "size_bytes": 463659
      }
    },
    {
      "id": "pantalla-03c-15-archivo-no-admitido-aprobada-final",
      "screen_code": "03C",
      "state_code": "15",
      "title": "Archivo no admitido",
      "group_title": "Captura y validación de identidad",
      "main_stage": 3,
      "approval_status": "APROBADA_FINAL",
      "approved_for_development": true,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/aprobadas/PANTALLA_03C_15_ARCHIVO_NO_ADMITIDO_APROBADA_FINAL.png",
      "original_filename": "PANTALLA_03C_15_ARCHIVO_NO_ADMITIDO_APROBADA_FINAL.png",
      "image": {
        "width": 941,
        "height": 1671,
        "sha256": "e492ef62d0c41e8bba1e5ef5a1b082958127483fb7ec4c5914f997f09e20fbe0",
        "size_bytes": 457433
      }
    },
    {
      "id": "pantalla-03c-16-lado-incorrecto-o-repetido-aprobada-final",
      "screen_code": "03C",
      "state_code": "16",
      "title": "Lado incorrecto o repetido",
      "group_title": "Captura y validación de identidad",
      "main_stage": 3,
      "approval_status": "APROBADA_FINAL",
      "approved_for_development": true,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/aprobadas/PANTALLA_03C_16_LADO_INCORRECTO_O_REPETIDO_APROBADA_FINAL.png",
      "original_filename": "PANTALLA_03C_16_LADO_INCORRECTO_O_REPETIDO_APROBADA_FINAL.png",
      "image": {
        "width": 941,
        "height": 1671,
        "sha256": "c2a7948212cec71fd2640230e5ee72f5a5ed1f8ba4b9ebf666025a9b7b60d089",
        "size_bytes": 462714
      }
    },
    {
      "id": "pantalla-03c-17-documento-no-paraguayo-aprobada-final",
      "screen_code": "03C",
      "state_code": "17",
      "title": "Documento no paraguayo",
      "group_title": "Captura y validación de identidad",
      "main_stage": 3,
      "approval_status": "APROBADA_FINAL",
      "approved_for_development": true,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/aprobadas/PANTALLA_03C_17_DOCUMENTO_NO_PARAGUAYO_APROBADA_FINAL.png",
      "original_filename": "PANTALLA_03C_17_DOCUMENTO_NO_PARAGUAYO_APROBADA_FINAL.png",
      "image": {
        "width": 941,
        "height": 1671,
        "sha256": "ebaaba8a22c9b353f0c593ac21df93d8e8114814ab5e029e16b4fda375388223",
        "size_bytes": 460871
      }
    },
    {
      "id": "pantalla-03c-18-cedula-vencida-aprobada-final",
      "screen_code": "03C",
      "state_code": "18",
      "title": "Cédula vencida",
      "group_title": "Captura y validación de identidad",
      "main_stage": 3,
      "approval_status": "APROBADA_FINAL",
      "approved_for_development": true,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/aprobadas/PANTALLA_03C_18_CEDULA_VENCIDA_APROBADA_FINAL.png",
      "original_filename": "PANTALLA_03C_18_CEDULA_VENCIDA_APROBADA_FINAL.png",
      "image": {
        "width": 941,
        "height": 1671,
        "sha256": "524c3978915c5b8715232d10f2f5dc175d621a9d90d050deb41dce057d5873b0",
        "size_bytes": 459671
      }
    },
    {
      "id": "pantalla-03c-19-posible-alteracion-aprobada-final",
      "screen_code": "03C",
      "state_code": "19",
      "title": "Posible alteracion",
      "group_title": "Captura y validación de identidad",
      "main_stage": 3,
      "approval_status": "APROBADA_FINAL",
      "approved_for_development": true,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/aprobadas/PANTALLA_03C_19_POSIBLE_ALTERACION_APROBADA_FINAL.png",
      "original_filename": "PANTALLA_03C_19_POSIBLE_ALTERACION_APROBADA_FINAL.png",
      "image": {
        "width": 941,
        "height": 1671,
        "sha256": "c26878f6ce562a3be338fc19b9f69d26abbc2df58d4eacb8a0803d8e5c610002",
        "size_bytes": 462152
      }
    },
    {
      "id": "pantalla-03c-20-camara-denegada-documento-aprobada-final",
      "screen_code": "03C",
      "state_code": "20",
      "title": "Camara denegada documento",
      "group_title": "Captura y validación de identidad",
      "main_stage": 3,
      "approval_status": "APROBADA_FINAL",
      "approved_for_development": true,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/aprobadas/PANTALLA_03C_20_CAMARA_DENEGADA_DOCUMENTO_APROBADA_FINAL.png",
      "original_filename": "PANTALLA_03C_20_CAMARA_DENEGADA_DOCUMENTO_APROBADA_FINAL.png",
      "image": {
        "width": 941,
        "height": 1671,
        "sha256": "332b7067181bd90f4bd395b6c6689de4729f9275721639101e7d626f4885d82b",
        "size_bytes": 461341
      }
    },
    {
      "id": "pantalla-03c-21-camara-denegada-selfie-aprobada-final",
      "screen_code": "03C",
      "state_code": "21",
      "title": "Camara denegada selfie",
      "group_title": "Captura y validación de identidad",
      "main_stage": 3,
      "approval_status": "APROBADA_FINAL",
      "approved_for_development": true,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/aprobadas/PANTALLA_03C_21_CAMARA_DENEGADA_SELFIE_APROBADA_FINAL.png",
      "original_filename": "PANTALLA_03C_21_CAMARA_DENEGADA_SELFIE_APROBADA_FINAL.png",
      "image": {
        "width": 941,
        "height": 1671,
        "sha256": "0a2fa3ee708b4ccce1ce5a05c14de124e771d9367d7c83dfd3e89978adfc15c2",
        "size_bytes": 456563
      }
    },
    {
      "id": "pantalla-03c-22-prueba-de-vida-fallida-aprobada-final",
      "screen_code": "03C",
      "state_code": "22",
      "title": "Prueba de vida fallida",
      "group_title": "Captura y validación de identidad",
      "main_stage": 3,
      "approval_status": "APROBADA_FINAL",
      "approved_for_development": true,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/aprobadas/PANTALLA_03C_22_PRUEBA_DE_VIDA_FALLIDA_APROBADA_FINAL.png",
      "original_filename": "PANTALLA_03C_22_PRUEBA_DE_VIDA_FALLIDA_APROBADA_FINAL.png",
      "image": {
        "width": 941,
        "height": 1671,
        "sha256": "e867dad4833cc1e9543b294967fcba829a062c0dcced1328dd25efa0b81452c5",
        "size_bytes": 454031
      }
    },
    {
      "id": "pantalla-03c-23-coincidencia-facial-fallida-aprobada-final",
      "screen_code": "03C",
      "state_code": "23",
      "title": "Coincidencia facial fallida",
      "group_title": "Captura y validación de identidad",
      "main_stage": 3,
      "approval_status": "APROBADA_FINAL",
      "approved_for_development": true,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/aprobadas/PANTALLA_03C_23_COINCIDENCIA_FACIAL_FALLIDA_APROBADA_FINAL.png",
      "original_filename": "PANTALLA_03C_23_COINCIDENCIA_FACIAL_FALLIDA_APROBADA_FINAL.png",
      "image": {
        "width": 941,
        "height": 1671,
        "sha256": "be6d0813da756cc894e6cebd3dac32450791a172c5e1027393d240df7f2ea931",
        "size_bytes": 455780
      }
    },
    {
      "id": "pantalla-03c-24-error-tecnico-aprobada-final",
      "screen_code": "03C",
      "state_code": "24",
      "title": "Error tecnico",
      "group_title": "Captura y validación de identidad",
      "main_stage": 3,
      "approval_status": "APROBADA_FINAL",
      "approved_for_development": true,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/aprobadas/PANTALLA_03C_24_ERROR_TECNICO_APROBADA_FINAL.png",
      "original_filename": "PANTALLA_03C_24_ERROR_TECNICO_APROBADA_FINAL.png",
      "image": {
        "width": 941,
        "height": 1671,
        "sha256": "49a0e651fc5260df5db3e83d083747cd0e68e471095d76e8e8f5d6acec0dc45d",
        "size_bytes": 459276
      }
    },
    {
      "id": "pantalla-03c-25-bloqueo-temporal-5-minutos-aprobada-final",
      "screen_code": "03C",
      "state_code": "25",
      "title": "Bloqueo temporal 5 minutos",
      "group_title": "Captura y validación de identidad",
      "main_stage": 3,
      "approval_status": "APROBADA_FINAL",
      "approved_for_development": true,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/aprobadas/PANTALLA_03C_25_BLOQUEO_TEMPORAL_5_MINUTOS_APROBADA_FINAL.png",
      "original_filename": "PANTALLA_03C_25_BLOQUEO_TEMPORAL_5_MINUTOS_APROBADA_FINAL.png",
      "image": {
        "width": 941,
        "height": 1671,
        "sha256": "47bba6e5bbc3ca2fd669f3a76f34eb125ed18084744135c51608eec6247147b4",
        "size_bytes": 464168
      }
    },
    {
      "id": "pantalla-03c-resumen-26-estados-aprobada-final",
      "screen_code": "03C",
      "state_code": "resumen-26-estados",
      "title": "Resumen 26 estados",
      "group_title": "Captura y validación de identidad",
      "main_stage": 3,
      "approval_status": "APROBADA_FINAL",
      "approved_for_development": false,
      "artifact_type": "summary_board",
      "reference_image": "assets/screens/aprobadas/PANTALLA_03C_RESUMEN_26_ESTADOS_APROBADA_FINAL.png",
      "original_filename": "PANTALLA_03C_RESUMEN_26_ESTADOS_APROBADA_FINAL.png",
      "image": {
        "width": 968,
        "height": 3320,
        "sha256": "747a0178f3f439e9f8784f0e95324646ebfae4ea2fa04862bdead88e73563224",
        "size_bytes": 583391
      }
    },
    {
      "id": "pantalla-03d-00-datos-extraidos-campos-pendientes-aprobada-final",
      "screen_code": "03D",
      "state_code": "00",
      "title": "Datos extraidos campos pendientes",
      "group_title": "Datos personales extraídos",
      "main_stage": 3,
      "approval_status": "APROBADA_FINAL",
      "approved_for_development": true,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/aprobadas/PANTALLA_03D_00_DATOS_EXTRAIDOS_CAMPOS_PENDIENTES_APROBADA_FINAL.png",
      "original_filename": "PANTALLA_03D_00_DATOS_EXTRAIDOS_CAMPOS_PENDIENTES_APROBADA_FINAL.png",
      "image": {
        "width": 941,
        "height": 1671,
        "sha256": "9f76d17309c6d685ed08188124e5fc93d752e201db658ab1e9c3c5df0ff42159",
        "size_bytes": 386318
      }
    },
    {
      "id": "pantalla-03d-01-menu-sexo-aprobada-final",
      "screen_code": "03D",
      "state_code": "01",
      "title": "Menu sexo",
      "group_title": "Datos personales extraídos",
      "main_stage": 3,
      "approval_status": "APROBADA_FINAL",
      "approved_for_development": true,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/aprobadas/PANTALLA_03D_01_MENU_SEXO_APROBADA_FINAL.png",
      "original_filename": "PANTALLA_03D_01_MENU_SEXO_APROBADA_FINAL.png",
      "image": {
        "width": 941,
        "height": 1671,
        "sha256": "ed0a25bd2e14f2b4d9a2fab89b5cdf9f736ca772a1b849284d574591c463e8e8",
        "size_bytes": 386954
      }
    },
    {
      "id": "pantalla-03d-02-menu-estado-civil-aprobada-final",
      "screen_code": "03D",
      "state_code": "02",
      "title": "Menu estado civil",
      "group_title": "Datos personales extraídos",
      "main_stage": 3,
      "approval_status": "APROBADA_FINAL",
      "approved_for_development": true,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/aprobadas/PANTALLA_03D_02_MENU_ESTADO_CIVIL_APROBADA_FINAL.png",
      "original_filename": "PANTALLA_03D_02_MENU_ESTADO_CIVIL_APROBADA_FINAL.png",
      "image": {
        "width": 941,
        "height": 1671,
        "sha256": "e805787449d2ec82ef07d4d4352b95888f1a7232e62f849a62f87d49dcd8da0e",
        "size_bytes": 386894
      }
    },
    {
      "id": "pantalla-03d-03-menu-pais-nacimiento-aprobada-final",
      "screen_code": "03D",
      "state_code": "03",
      "title": "Menu pais nacimiento",
      "group_title": "Datos personales extraídos",
      "main_stage": 3,
      "approval_status": "APROBADA_FINAL",
      "approved_for_development": true,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/aprobadas/PANTALLA_03D_03_MENU_PAIS_NACIMIENTO_APROBADA_FINAL.png",
      "original_filename": "PANTALLA_03D_03_MENU_PAIS_NACIMIENTO_APROBADA_FINAL.png",
      "image": {
        "width": 941,
        "height": 1671,
        "sha256": "532653987035b91d65cfe1653ea9d77488606f310432d001f4db30011e05f430",
        "size_bytes": 347339
      }
    },
    {
      "id": "pantalla-03d-04-menu-nacionalidad-aprobada-final",
      "screen_code": "03D",
      "state_code": "04",
      "title": "Menu nacionalidad",
      "group_title": "Datos personales extraídos",
      "main_stage": 3,
      "approval_status": "APROBADA_FINAL",
      "approved_for_development": true,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/aprobadas/PANTALLA_03D_04_MENU_NACIONALIDAD_APROBADA_FINAL.png",
      "original_filename": "PANTALLA_03D_04_MENU_NACIONALIDAD_APROBADA_FINAL.png",
      "image": {
        "width": 941,
        "height": 1671,
        "sha256": "5f6cce3e95b57ed54c1b4bf97b747e6c4ba1b576a4866aac34545e771fc0de2d",
        "size_bytes": 347604
      }
    },
    {
      "id": "pantalla-03d-05-menu-pais-residencia-aprobada-final",
      "screen_code": "03D",
      "state_code": "05",
      "title": "Menu pais residencia",
      "group_title": "Datos personales extraídos",
      "main_stage": 3,
      "approval_status": "APROBADA_FINAL",
      "approved_for_development": true,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/aprobadas/PANTALLA_03D_05_MENU_PAIS_RESIDENCIA_APROBADA_FINAL.png",
      "original_filename": "PANTALLA_03D_05_MENU_PAIS_RESIDENCIA_APROBADA_FINAL.png",
      "image": {
        "width": 941,
        "height": 1671,
        "sha256": "1ee18f043687d73971039de8fc02c6f1062a2f0620a930526be48faeb68a4b03",
        "size_bytes": 347379
      }
    },
    {
      "id": "pantalla-03d-06-menu-ciudad-aprobada-final",
      "screen_code": "03D",
      "state_code": "06",
      "title": "Menu ciudad",
      "group_title": "Datos personales extraídos",
      "main_stage": 3,
      "approval_status": "APROBADA_FINAL",
      "approved_for_development": true,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/aprobadas/PANTALLA_03D_06_MENU_CIUDAD_APROBADA_FINAL.png",
      "original_filename": "PANTALLA_03D_06_MENU_CIUDAD_APROBADA_FINAL.png",
      "image": {
        "width": 941,
        "height": 1671,
        "sha256": "7b0127eeac9232bc7e5efb2d1d9c286d4ae9aa8ace8388992b6ebc98123f8ca8",
        "size_bytes": 349975
      }
    },
    {
      "id": "pantalla-03d-07-todos-los-datos-completos-aprobada-final",
      "screen_code": "03D",
      "state_code": "07",
      "title": "Todos los datos completos",
      "group_title": "Datos personales extraídos",
      "main_stage": 3,
      "approval_status": "APROBADA_FINAL",
      "approved_for_development": true,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/aprobadas/PANTALLA_03D_07_TODOS_LOS_DATOS_COMPLETOS_APROBADA_FINAL.png",
      "original_filename": "PANTALLA_03D_07_TODOS_LOS_DATOS_COMPLETOS_APROBADA_FINAL.png",
      "image": {
        "width": 941,
        "height": 1671,
        "sha256": "0e41cb6e4a70165a83c4a35a8c53e1e2b5183a72a790eaa3d8f0221c08a0c8a6",
        "size_bytes": 383387
      }
    },
    {
      "id": "pantalla-03d-08-editando-dato-extraido-aprobada-final",
      "screen_code": "03D",
      "state_code": "08",
      "title": "Editando dato extraido",
      "group_title": "Datos personales extraídos",
      "main_stage": 3,
      "approval_status": "APROBADA_FINAL",
      "approved_for_development": true,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/aprobadas/PANTALLA_03D_08_EDITANDO_DATO_EXTRAIDO_APROBADA_FINAL.png",
      "original_filename": "PANTALLA_03D_08_EDITANDO_DATO_EXTRAIDO_APROBADA_FINAL.png",
      "image": {
        "width": 941,
        "height": 1671,
        "sha256": "1d0dd690943ecaaedc4ab7851ca1651e54f96d2452a19ff0e48dea54d09a34cd",
        "size_bytes": 382990
      }
    },
    {
      "id": "pantalla-03d-09-cambio-registrado-aprobada-final",
      "screen_code": "03D",
      "state_code": "09",
      "title": "Cambio registrado",
      "group_title": "Datos personales extraídos",
      "main_stage": 3,
      "approval_status": "APROBADA_FINAL",
      "approved_for_development": true,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/aprobadas/PANTALLA_03D_09_CAMBIO_REGISTRADO_APROBADA_FINAL.png",
      "original_filename": "PANTALLA_03D_09_CAMBIO_REGISTRADO_APROBADA_FINAL.png",
      "image": {
        "width": 941,
        "height": 1671,
        "sha256": "ed77b0c8782a2e884143a783fe9bff62368d2a20792741931b7eafe2717fff38",
        "size_bytes": 382113
      }
    },
    {
      "id": "pantalla-03d-10-campo-obligatorio-faltante-aprobada-final",
      "screen_code": "03D",
      "state_code": "10",
      "title": "Campo obligatorio faltante",
      "group_title": "Datos personales extraídos",
      "main_stage": 3,
      "approval_status": "APROBADA_FINAL",
      "approved_for_development": true,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/aprobadas/PANTALLA_03D_10_CAMPO_OBLIGATORIO_FALTANTE_APROBADA_FINAL.png",
      "original_filename": "PANTALLA_03D_10_CAMPO_OBLIGATORIO_FALTANTE_APROBADA_FINAL.png",
      "image": {
        "width": 941,
        "height": 1671,
        "sha256": "494cad6b27aacf7d9952cf3d87ff4c1ee09e1a1ada0331e0db312b9bb988fca5",
        "size_bytes": 391659
      }
    },
    {
      "id": "pantalla-03d-11-fecha-nacimiento-invalida-aprobada-final",
      "screen_code": "03D",
      "state_code": "11",
      "title": "Fecha nacimiento invalida",
      "group_title": "Datos personales extraídos",
      "main_stage": 3,
      "approval_status": "APROBADA_FINAL",
      "approved_for_development": true,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/aprobadas/PANTALLA_03D_11_FECHA_NACIMIENTO_INVALIDA_APROBADA_FINAL.png",
      "original_filename": "PANTALLA_03D_11_FECHA_NACIMIENTO_INVALIDA_APROBADA_FINAL.png",
      "image": {
        "width": 941,
        "height": 1671,
        "sha256": "842dc183fa4fdfafd7fa721793e2672045caf7ffb5c81ab92010f2afb3de7a3b",
        "size_bytes": 390418
      }
    },
    {
      "id": "pantalla-03d-12-validando-datos-aprobada-final",
      "screen_code": "03D",
      "state_code": "12",
      "title": "Validando datos",
      "group_title": "Datos personales extraídos",
      "main_stage": 3,
      "approval_status": "APROBADA_FINAL",
      "approved_for_development": true,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/aprobadas/PANTALLA_03D_12_VALIDANDO_DATOS_APROBADA_FINAL.png",
      "original_filename": "PANTALLA_03D_12_VALIDANDO_DATOS_APROBADA_FINAL.png",
      "image": {
        "width": 941,
        "height": 1671,
        "sha256": "e2e1e470e08264c56f5b548b8faa3c4e746de6f36c2885d62541ae1bfeaadc1d",
        "size_bytes": 384049
      }
    },
    {
      "id": "pantalla-03d-13-no-elegible-por-edad-aprobada-final",
      "screen_code": "03D",
      "state_code": "13",
      "title": "No elegible por edad",
      "group_title": "Datos personales extraídos",
      "main_stage": 3,
      "approval_status": "APROBADA_FINAL",
      "approved_for_development": true,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/aprobadas/PANTALLA_03D_13_NO_ELEGIBLE_POR_EDAD_APROBADA_FINAL.png",
      "original_filename": "PANTALLA_03D_13_NO_ELEGIBLE_POR_EDAD_APROBADA_FINAL.png",
      "image": {
        "width": 941,
        "height": 1671,
        "sha256": "3e57ee3f259473885fe5586d7987f87151e849dd09099b66ecb3fdbff3567db2",
        "size_bytes": 280729
      }
    },
    {
      "id": "pantalla-03d-resumen-14-estados-aprobada-final",
      "screen_code": "03D",
      "state_code": "resumen-14-estados",
      "title": "Resumen 14 estados",
      "group_title": "Datos personales extraídos",
      "main_stage": 3,
      "approval_status": "APROBADA_FINAL",
      "approved_for_development": false,
      "artifact_type": "summary_board",
      "reference_image": "assets/screens/aprobadas/PANTALLA_03D_RESUMEN_14_ESTADOS_APROBADA_FINAL.png",
      "original_filename": "PANTALLA_03D_RESUMEN_14_ESTADOS_APROBADA_FINAL.png",
      "image": {
        "width": 968,
        "height": 1940,
        "sha256": "0a1b3bc9365d99b466b0ce3273300b6b29a1419b7c4472d19ad574aab9a4ee59",
        "size_bytes": 320677
      }
    },
    {
      "id": "pantalla-03e-00-inicial-candidata",
      "screen_code": "03E",
      "state_code": "00",
      "title": "Inicial",
      "group_title": "Actividad e ingresos",
      "main_stage": 3,
      "approval_status": "CANDIDATA",
      "approved_for_development": false,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/candidatas/PANTALLA_03E_00_INICIAL_CANDIDATA.png",
      "original_filename": "PANTALLA_03E_00_INICIAL_CANDIDATA.png",
      "image": {
        "width": 941,
        "height": 1671,
        "sha256": "1235e9d97a563806b5ca8ff3cde4c20f5e593826c98fa2d868d002880f0c2f7d",
        "size_bytes": 320077
      }
    },
    {
      "id": "pantalla-03e-01-menu-situacion-laboral-candidata",
      "screen_code": "03E",
      "state_code": "01",
      "title": "Menu situacion laboral",
      "group_title": "Actividad e ingresos",
      "main_stage": 3,
      "approval_status": "CANDIDATA",
      "approved_for_development": false,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/candidatas/PANTALLA_03E_01_MENU_SITUACION_LABORAL_CANDIDATA.png",
      "original_filename": "PANTALLA_03E_01_MENU_SITUACION_LABORAL_CANDIDATA.png",
      "image": {
        "width": 941,
        "height": 1671,
        "sha256": "86cdbd533657a655109375d7a8ef6862419c0ad1551ff4518e793ad149a7e500",
        "size_bytes": 284020
      }
    },
    {
      "id": "pantalla-03e-02-empleado-empresa-habilitada-candidata",
      "screen_code": "03E",
      "state_code": "02",
      "title": "Empleado empresa habilitada",
      "group_title": "Actividad e ingresos",
      "main_stage": 3,
      "approval_status": "CANDIDATA",
      "approved_for_development": false,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/candidatas/PANTALLA_03E_02_EMPLEADO_EMPRESA_HABILITADA_CANDIDATA.png",
      "original_filename": "PANTALLA_03E_02_EMPLEADO_EMPRESA_HABILITADA_CANDIDATA.png",
      "image": {
        "width": 941,
        "height": 1671,
        "sha256": "adee6d646960b8a6895709f1917cde5ff95c382ac7a7544806d038ed1617b74d",
        "size_bytes": 319665
      }
    },
    {
      "id": "pantalla-03e-03-propietario-empresa-habilitada-candidata",
      "screen_code": "03E",
      "state_code": "03",
      "title": "Propietario empresa habilitada",
      "group_title": "Actividad e ingresos",
      "main_stage": 3,
      "approval_status": "CANDIDATA",
      "approved_for_development": false,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/candidatas/PANTALLA_03E_03_PROPIETARIO_EMPRESA_HABILITADA_CANDIDATA.png",
      "original_filename": "PANTALLA_03E_03_PROPIETARIO_EMPRESA_HABILITADA_CANDIDATA.png",
      "image": {
        "width": 941,
        "height": 1671,
        "sha256": "d11f360578632d29cdefd825f5a626848de1ab36ad08b38c5048666c57c80850",
        "size_bytes": 319464
      }
    },
    {
      "id": "pantalla-03e-04-estudiante-autocompletado-candidata",
      "screen_code": "03E",
      "state_code": "04",
      "title": "Estudiante autocompletado",
      "group_title": "Actividad e ingresos",
      "main_stage": 3,
      "approval_status": "CANDIDATA",
      "approved_for_development": false,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/candidatas/PANTALLA_03E_04_ESTUDIANTE_AUTOCOMPLETADO_CANDIDATA.png",
      "original_filename": "PANTALLA_03E_04_ESTUDIANTE_AUTOCOMPLETADO_CANDIDATA.png",
      "image": {
        "width": 941,
        "height": 1671,
        "sha256": "3382b6ba1456b6e90c696d9da31ed2feab8c31a4becf05714abf4d6e4ee0202e",
        "size_bytes": 316539
      }
    },
    {
      "id": "pantalla-03e-05-desempleado-autocompletado-candidata",
      "screen_code": "03E",
      "state_code": "05",
      "title": "Desempleado autocompletado",
      "group_title": "Actividad e ingresos",
      "main_stage": 3,
      "approval_status": "CANDIDATA",
      "approved_for_development": false,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/candidatas/PANTALLA_03E_05_DESEMPLEADO_AUTOCOMPLETADO_CANDIDATA.png",
      "original_filename": "PANTALLA_03E_05_DESEMPLEADO_AUTOCOMPLETADO_CANDIDATA.png",
      "image": {
        "width": 941,
        "height": 1671,
        "sha256": "f4650c7932ff929611b366443421350a4f1dc9e60ce58404f8ead0669f291e5e",
        "size_bytes": 317561
      }
    },
    {
      "id": "pantalla-03e-06-trabajador-hogar-autocompletado-candidata",
      "screen_code": "03E",
      "state_code": "06",
      "title": "Trabajador hogar autocompletado",
      "group_title": "Actividad e ingresos",
      "main_stage": 3,
      "approval_status": "CANDIDATA",
      "approved_for_development": false,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/candidatas/PANTALLA_03E_06_TRABAJADOR_HOGAR_AUTOCOMPLETADO_CANDIDATA.png",
      "original_filename": "PANTALLA_03E_06_TRABAJADOR_HOGAR_AUTOCOMPLETADO_CANDIDATA.png",
      "image": {
        "width": 941,
        "height": 1671,
        "sha256": "0842bc2d5d29a105fa16dbab9d4a95793ca54ecc274672a15e6511ca975f6d07",
        "size_bytes": 318038
      }
    },
    {
      "id": "pantalla-03e-07-jubilado-autocompletado-candidata",
      "screen_code": "03E",
      "state_code": "07",
      "title": "Jubilado autocompletado",
      "group_title": "Actividad e ingresos",
      "main_stage": 3,
      "approval_status": "CANDIDATA",
      "approved_for_development": false,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/candidatas/PANTALLA_03E_07_JUBILADO_AUTOCOMPLETADO_CANDIDATA.png",
      "original_filename": "PANTALLA_03E_07_JUBILADO_AUTOCOMPLETADO_CANDIDATA.png",
      "image": {
        "width": 941,
        "height": 1671,
        "sha256": "b842c7e1907dd70bea278733632cfccb7d8c77b05beb93aa0260296130dde5c0",
        "size_bytes": 316311
      }
    },
    {
      "id": "pantalla-03e-08-menu-actividad-economica-candidata",
      "screen_code": "03E",
      "state_code": "08",
      "title": "Menu actividad economica",
      "group_title": "Actividad e ingresos",
      "main_stage": 3,
      "approval_status": "CANDIDATA",
      "approved_for_development": false,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/candidatas/PANTALLA_03E_08_MENU_ACTIVIDAD_ECONOMICA_CANDIDATA.png",
      "original_filename": "PANTALLA_03E_08_MENU_ACTIVIDAD_ECONOMICA_CANDIDATA.png",
      "image": {
        "width": 941,
        "height": 1671,
        "sha256": "17cd3207daf19bd6aa922e305e8769ffa9ae459e2be95b9de93b6f6a2bb37618",
        "size_bytes": 283060
      }
    },
    {
      "id": "pantalla-03e-09-menu-ocupacion-oficio-candidata",
      "screen_code": "03E",
      "state_code": "09",
      "title": "Menu ocupacion oficio",
      "group_title": "Actividad e ingresos",
      "main_stage": 3,
      "approval_status": "CANDIDATA",
      "approved_for_development": false,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/candidatas/PANTALLA_03E_09_MENU_OCUPACION_OFICIO_CANDIDATA.png",
      "original_filename": "PANTALLA_03E_09_MENU_OCUPACION_OFICIO_CANDIDATA.png",
      "image": {
        "width": 941,
        "height": 1671,
        "sha256": "a97331f8f9d5906245b689a4f51c993bb45fefa2e2aff15b9383adc72ae60236",
        "size_bytes": 287235
      }
    },
    {
      "id": "pantalla-03e-10-menu-profesion-candidata",
      "screen_code": "03E",
      "state_code": "10",
      "title": "Menu profesion",
      "group_title": "Actividad e ingresos",
      "main_stage": 3,
      "approval_status": "CANDIDATA",
      "approved_for_development": false,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/candidatas/PANTALLA_03E_10_MENU_PROFESION_CANDIDATA.png",
      "original_filename": "PANTALLA_03E_10_MENU_PROFESION_CANDIDATA.png",
      "image": {
        "width": 941,
        "height": 1671,
        "sha256": "6f362cb907373df3d972bfd588a2b855e82d8d761f99d39077d7c4cb9158d083",
        "size_bytes": 282796
      }
    },
    {
      "id": "pantalla-03e-11-menu-origen-ingresos-candidata",
      "screen_code": "03E",
      "state_code": "11",
      "title": "Menu origen ingresos",
      "group_title": "Actividad e ingresos",
      "main_stage": 3,
      "approval_status": "CANDIDATA",
      "approved_for_development": false,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/candidatas/PANTALLA_03E_11_MENU_ORIGEN_INGRESOS_CANDIDATA.png",
      "original_filename": "PANTALLA_03E_11_MENU_ORIGEN_INGRESOS_CANDIDATA.png",
      "image": {
        "width": 941,
        "height": 1671,
        "sha256": "2253283a8dec6964b9d27d451ce882d2867d69a18d2b19c670962acec76f2bec",
        "size_bytes": 284326
      }
    },
    {
      "id": "pantalla-03e-13-datos-completos-pep-pendiente-candidata",
      "screen_code": "03E",
      "state_code": "13",
      "title": "Datos completos PEP pendiente",
      "group_title": "Actividad e ingresos",
      "main_stage": 3,
      "approval_status": "CANDIDATA",
      "approved_for_development": false,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/candidatas/PANTALLA_03E_13_DATOS_COMPLETOS_PEP_PENDIENTE_CANDIDATA.png",
      "original_filename": "PANTALLA_03E_13_DATOS_COMPLETOS_PEP_PENDIENTE_CANDIDATA.png",
      "image": {
        "width": 941,
        "height": 1671,
        "sha256": "436d92f48b0c8bb53f2dd83b0709ee8cb3d22e63d4b5b3729c1915bc05ee5c7a",
        "size_bytes": 317381
      }
    },
    {
      "id": "pantalla-03e-14-lista-pep-no-candidata",
      "screen_code": "03E",
      "state_code": "14",
      "title": "Lista PEP no",
      "group_title": "Actividad e ingresos",
      "main_stage": 3,
      "approval_status": "CANDIDATA",
      "approved_for_development": false,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/candidatas/PANTALLA_03E_14_LISTA_PEP_NO_CANDIDATA.png",
      "original_filename": "PANTALLA_03E_14_LISTA_PEP_NO_CANDIDATA.png",
      "image": {
        "width": 941,
        "height": 1671,
        "sha256": "2ea224ef87839209ffbc2f666d5cd20ad722f83c1078e4b568bbd1e424ceb8fb",
        "size_bytes": 318217
      }
    },
    {
      "id": "pantalla-03e-15-lista-pep-si-candidata",
      "screen_code": "03E",
      "state_code": "15",
      "title": "Lista PEP si",
      "group_title": "Actividad e ingresos",
      "main_stage": 3,
      "approval_status": "CANDIDATA",
      "approved_for_development": false,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/candidatas/PANTALLA_03E_15_LISTA_PEP_SI_CANDIDATA.png",
      "original_filename": "PANTALLA_03E_15_LISTA_PEP_SI_CANDIDATA.png",
      "image": {
        "width": 941,
        "height": 1671,
        "sha256": "6c87ae0e955854f104c1c02bf29dc17e5348a64e2d4d0925e9a17f26a0fc2c37",
        "size_bytes": 320067
      }
    },
    {
      "id": "pantalla-03e-16-campo-obligatorio-faltante-candidata",
      "screen_code": "03E",
      "state_code": "16",
      "title": "Campo obligatorio faltante",
      "group_title": "Actividad e ingresos",
      "main_stage": 3,
      "approval_status": "CANDIDATA",
      "approved_for_development": false,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/candidatas/PANTALLA_03E_16_CAMPO_OBLIGATORIO_FALTANTE_CANDIDATA.png",
      "original_filename": "PANTALLA_03E_16_CAMPO_OBLIGATORIO_FALTANTE_CANDIDATA.png",
      "image": {
        "width": 941,
        "height": 1671,
        "sha256": "aef6078a4cd6b2f9df77374ac1039dbccd472ac44e335546ab50fc0a4b4a7695",
        "size_bytes": 326596
      }
    },
    {
      "id": "pantalla-03e-17-empresa-condicional-faltante-candidata",
      "screen_code": "03E",
      "state_code": "17",
      "title": "Empresa condicional faltante",
      "group_title": "Actividad e ingresos",
      "main_stage": 3,
      "approval_status": "CANDIDATA",
      "approved_for_development": false,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/candidatas/PANTALLA_03E_17_EMPRESA_CONDICIONAL_FALTANTE_CANDIDATA.png",
      "original_filename": "PANTALLA_03E_17_EMPRESA_CONDICIONAL_FALTANTE_CANDIDATA.png",
      "image": {
        "width": 941,
        "height": 1671,
        "sha256": "4fbcc9cfa4e37b76e34484915c515ec7a9be3aa4d18b0713f45e0d32226a0e11",
        "size_bytes": 329100
      }
    },
    {
      "id": "pantalla-03e-18-ingreso-no-valido-candidata",
      "screen_code": "03E",
      "state_code": "18",
      "title": "Ingreso no valido",
      "group_title": "Actividad e ingresos",
      "main_stage": 3,
      "approval_status": "CANDIDATA",
      "approved_for_development": false,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/candidatas/PANTALLA_03E_18_INGRESO_NO_VALIDO_CANDIDATA.png",
      "original_filename": "PANTALLA_03E_18_INGRESO_NO_VALIDO_CANDIDATA.png",
      "image": {
        "width": 941,
        "height": 1671,
        "sha256": "9a342f13bbad6b93f8bbca78973c09da3781aa94010f62fbcb20b435f1f410a2",
        "size_bytes": 326996
      }
    },
    {
      "id": "pantalla-03e-19-validando-pep-no-candidata",
      "screen_code": "03E",
      "state_code": "19",
      "title": "Validando PEP no",
      "group_title": "Actividad e ingresos",
      "main_stage": 3,
      "approval_status": "CANDIDATA",
      "approved_for_development": false,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/candidatas/PANTALLA_03E_19_VALIDANDO_PEP_NO_CANDIDATA.png",
      "original_filename": "PANTALLA_03E_19_VALIDANDO_PEP_NO_CANDIDATA.png",
      "image": {
        "width": 941,
        "height": 1671,
        "sha256": "048d932074ea00bb4ae2ccf6245a82e57c1a19b8e9cfa9b528716049f45211c6",
        "size_bytes": 319009
      }
    },
    {
      "id": "pantalla-03e-20-registrando-revision-pep-si-candidata",
      "screen_code": "03E",
      "state_code": "20",
      "title": "Registrando revision PEP si",
      "group_title": "Actividad e ingresos",
      "main_stage": 3,
      "approval_status": "CANDIDATA",
      "approved_for_development": false,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/candidatas/PANTALLA_03E_20_REGISTRANDO_REVISION_PEP_SI_CANDIDATA.png",
      "original_filename": "PANTALLA_03E_20_REGISTRANDO_REVISION_PEP_SI_CANDIDATA.png",
      "image": {
        "width": 941,
        "height": 1671,
        "sha256": "79cfd373e883205a7a3458909fb723fed365932d3d27a729f932372593b4d19b",
        "size_bytes": 321457
      }
    },
    {
      "id": "pantalla-03e1-12-que-significa-pep-candidata",
      "screen_code": "03E1",
      "state_code": "12",
      "title": "Que significa PEP",
      "group_title": "Ayuda: qué significa PEP",
      "main_stage": 3,
      "approval_status": "CANDIDATA",
      "approved_for_development": false,
      "artifact_type": "detail_view",
      "reference_image": "assets/screens/candidatas/PANTALLA_03E1_12_QUE_SIGNIFICA_PEP_CANDIDATA.png",
      "original_filename": "PANTALLA_03E1_12_QUE_SIGNIFICA_PEP_CANDIDATA.png",
      "image": {
        "width": 941,
        "height": 1671,
        "sha256": "454a87743cfc918b03b250c1b52788868ebfc3ce438690b532cb61eec99e3675",
        "size_bytes": 284521
      }
    },
    {
      "id": "pantalla-03e2-21-revision-manual-registrada-aprobada-final",
      "screen_code": "03E2",
      "state_code": "21",
      "title": "Revision manual registrada",
      "group_title": "Revisión manual por condición PEP",
      "main_stage": 4,
      "approval_status": "APROBADA_FINAL",
      "approved_for_development": true,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/aprobadas/PANTALLA_03E2_21_REVISION_MANUAL_REGISTRADA_APROBADA_FINAL.png",
      "original_filename": "PANTALLA_03E2_21_REVISION_MANUAL_REGISTRADA_APROBADA_FINAL.png",
      "image": {
        "width": 854,
        "height": 1863,
        "sha256": "861982e1d2bcc5830a04495196a46b19f197fdd70198f9a46c5e0bb05fd2b855",
        "size_bytes": 1462456
      }
    },
    {
      "id": "pantalla-03e2a-22-confirmar-cierre-sesion-aprobada-final",
      "screen_code": "03E2A",
      "state_code": "22",
      "title": "Confirmar cierre sesion",
      "group_title": "Confirmación de cierre de sesión",
      "main_stage": 4,
      "approval_status": "APROBADA_FINAL",
      "approved_for_development": true,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/aprobadas/PANTALLA_03E2A_22_CONFIRMAR_CIERRE_SESION_APROBADA_FINAL.png",
      "original_filename": "PANTALLA_03E2A_22_CONFIRMAR_CIERRE_SESION_APROBADA_FINAL.png",
      "image": {
        "width": 854,
        "height": 1863,
        "sha256": "260b0a7c31d72f4fb51dad01a2cce73a5d1702321200033cc364288921045158",
        "size_bytes": 963923
      }
    },
    {
      "id": "pantalla-03e2b-22-error-registro-revision-aprobada-final",
      "screen_code": "03E2B",
      "state_code": "22",
      "title": "Error registro revision",
      "group_title": "Error al registrar revisión",
      "main_stage": 4,
      "approval_status": "APROBADA_FINAL",
      "approved_for_development": true,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/aprobadas/PANTALLA_03E2B_22_ERROR_REGISTRO_REVISION_APROBADA_FINAL.png",
      "original_filename": "PANTALLA_03E2B_22_ERROR_REGISTRO_REVISION_APROBADA_FINAL.png",
      "image": {
        "width": 854,
        "height": 1853,
        "sha256": "58f314ade1dbc09b057c56f46f8693fec261e27d31801760db088001b0e1ae30",
        "size_bytes": 485389
      }
    },
    {
      "id": "pantalla-04a-00-datos-y-declaraciones-aprobada-final",
      "screen_code": "04A",
      "state_code": "00",
      "title": "Datos y declaraciones",
      "group_title": "Datos y declaraciones",
      "main_stage": 4,
      "approval_status": "APROBADA_FINAL",
      "approved_for_development": true,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/aprobadas/PANTALLA_04A_00_DATOS_Y_DECLARACIONES_APROBADA_FINAL.png",
      "original_filename": "PANTALLA_04A_00_DATOS_Y_DECLARACIONES_APROBADA_FINAL.png",
      "image": {
        "width": 853,
        "height": 1846,
        "sha256": "5a62db770b2be916b88c4b74cb022f5e3b9f0a88f38043ef4afd3b1bf6749ecc",
        "size_bytes": 1437842
      }
    },
    {
      "id": "pantalla-04a1-00-evaluacion-manual-medica-aprobada-final",
      "screen_code": "04A1",
      "state_code": "00",
      "title": "Evaluacion manual medica",
      "group_title": "Evaluación manual médica",
      "main_stage": 4,
      "approval_status": "APROBADA_FINAL",
      "approved_for_development": true,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/aprobadas/PANTALLA_04A1_00_EVALUACION_MANUAL_MEDICA_APROBADA_FINAL.png",
      "original_filename": "PANTALLA_04A1_00_EVALUACION_MANUAL_MEDICA_APROBADA_FINAL.png",
      "image": {
        "width": 853,
        "height": 1846,
        "sha256": "4f07d2faa1f0e9d0543c7d21f71e0f5d2b57cabebfcc5041d6a70fffeb2e2718",
        "size_bytes": 1426411
      }
    },
    {
      "id": "pantalla-04d-00-consentimientos-aprobada-final",
      "screen_code": "04D",
      "state_code": "00",
      "title": "Consentimientos",
      "group_title": "Consentimientos",
      "main_stage": 4,
      "approval_status": "APROBADA_FINAL",
      "approved_for_development": true,
      "artifact_type": "runtime_view",
      "reference_image": "assets/screens/aprobadas/PANTALLA_04D_00_CONSENTIMIENTOS_APROBADA_FINAL.png",
      "original_filename": "PANTALLA_04D_00_CONSENTIMIENTOS_APROBADA_FINAL.png",
      "image": {
        "width": 853,
        "height": 1846,
        "sha256": "3de389ccb1c8b5cf9eb08f2a47efa69d4972b987a7bd6f4ac8fe9bf0a4a97d66",
        "size_bytes": 1231137
      }
    }
  ],
  "pending_gates": [
    {
      "screen_code": "03E",
      "status": "CANDIDATA",
      "reason": "Existen 21 estados visuales, pero ninguno tiene aprobación final para implementación."
    },
    {
      "screen_code": "04E",
      "title": "Revisión y firma final",
      "status": "PENDIENTE",
      "reason": "Es el punto de reanudación de la revisión; no existe arte APROBADA FINAL en el archivo recuperado."
    },
    {
      "screen_code": "05A",
      "title": "Pago Bancard",
      "status": "SIN_ARTE_APROBADO_RECUPERADO",
      "reason": "La regla funcional existe, pero no hay pantalla aprobada en el archivo recuperado."
    },
    {
      "screen_code": "05B",
      "title": "Confirmación y emisión",
      "status": "SIN_ARTE_APROBADO_RECUPERADO",
      "reason": "La regla funcional existe, pero no hay pantalla aprobada en el archivo recuperado."
    }
  ],
  "integration_boundaries": [
    "WhatsApp/SMS OTP",
    "OCR de cédula, prueba de vida y coincidencia facial",
    "Firma electrónica del cliente e integración Code100",
    "Bancard vPOS y QR",
    "Emisión e intercambio con Alianza/Sebaot"
  ]
};
