# **Plan de CI/CD para SeguroLoTengo (AAB1)**

Contexto que condiciona cada decisión: no autoalojar PAN/CVV (Bancard), rastro probatorio inmutable (Ley 6822/21), minimización de datos y protección reforzada de campos de salud/PEP (SEPRELAD 71/19, Ley 4868/13), regla atómica de firma (cliente → Interseguros/Alianza en paralelo vía Code100), y arquitectura modular en AWS con integraciones externas (Cloudflare, Infobip, Entrust/Onfido, ComplyAdvantage, SEBAOT).

---

## **1\. Verificaciones de seguridad — herramientas recomendadas (económicas)**

| Capa | Riesgo específico del proyecto | Herramienta sugerida | Costo aprox. |
| ----- | ----- | ----- | ----- |
| **Secret scanning** | Tokens de Bancard/Code100/SEPRELAD filtrados en el repo | **Gitleaks** (OSS, pre-commit \+ CI) \+ **GitHub Secret Scanning con Push Protection** | Gratis (público) / incluido en GHAS |
| **SAST** | Lógica de firma/pago con fallos que rompan la regla atómica | **Semgrep** (reglas propias para "no cobrar sin firma", "no emitir sin pago") | Gratis OSS / Semgrep Team \~US$40 por dev/mes (opcional) |
| **SCA (dependencias)** | Librerías de firma, PDF, KYC con CVEs | **Dependabot** (nativo, gratis) \+ **Snyk** free tier (200 tests/mes) | Gratis en la práctica para equipo chico |
| **IaC scanning** | Terraform/CDK que exponga buckets S3 con evidencia (Object Lock) | **Checkov** o **tfsec** (OSS) | Gratis |
| **Contenedores** | Imágenes ECS/Lambda con CVEs | **Trivy** (OSS, además sirve para IaC y SCA) \+ **Amazon ECR scanning** (nativo) | Gratis |
| **DAST** | Endpoints de OTP/firma/pago vulnerables (XSS, IDOR) | **OWASP ZAP** en pipeline contra ambiente de staging | Gratis |
| **Pentest externo** | Cumplimiento razonable ante SS y PCI de Bancard | 1 pentest anual con proveedor local certificado | Variable, pero necesario aunque sea 1x/año |
| **Compliance de licencias** | Evitar librerías con licencias incompatibles en un producto regulado | **FOSSA free tier** o Snyk License | Gratis/limitado |

**Reglas internas obligatorias que conviene automatizar como checks de CI (no solo herramientas de terceros):**

* Test que falle el build si se detecta un campo `pan`, `cvv`, `password` sin máscara en logs o payloads de test.  
* Test de contrato que verifique que ningún endpoint pueda invocar `sign-pdf` de Code100 antes de `session-start`, ni ejecutar captura Bancard antes de la firma del cliente (regla atómica).  
* Linter de PII: bloquear commits que contengan cédulas, correos o teléfonos reales en fixtures.

---

## **2\. Herramientas de GitHub (algunas de pago, pero acotadas)**

| Necesidad | Herramienta GitHub | Notas |
| ----- | ----- | ----- |
| Pipelines | **GitHub Actions** | Motor único de CI/CD; runners hospedados o self-hosted en AWS |
| Seguridad avanzada | **GitHub Advanced Security (GHAS)**: CodeQL \+ secret scanning push protection \+ dependency review | De pago para repos privados (por "committer activo"); justificable dado el rubro regulado |
| Control de cambios | **CODEOWNERS \+ branch protection rules** | Exigir revisión de al menos 1-2 personas en `main` y en carpetas de firma/pago |
| Gestión de dependencias | **Dependabot** (alerts \+ security updates) | Gratis, ya incluido |
| Autenticación sin secretos largos | **OIDC de GitHub Actions hacia AWS (IAM Roles)** | Elimina AWS keys estáticas en el repo — crítico para el punto 78-83 de tu matriz de cumplimiento |
| Trazabilidad de commits | **Commits firmados (GPG/SSH) obligatorios** vía branch protection | Refuerza la cadena de evidencia (Ley 6822/21 art. 42(5), 66\) |
| Registro de imágenes | **GitHub Packages** o Amazon ECR (recomendado, ya que todo el resto vive en AWS) | — |
| Auditoría organizacional | **GitHub Enterprise audit log** (o exportación vía API a S3 con Object Lock si no hay Enterprise) | Necesario para el requisito de auditoría técnica (punto 29 de tu ecosistema) |
| Gestión de entornos | **GitHub Environments** (dev/staging/prod) con *required reviewers* y *wait timer* | Ver sección 3 |

---

## **3\. Ambientes (dev/test/staging/prod) y su coordinación con GitHub**

### **3.1 Estrategia de cuentas AWS**

* **Una cuenta AWS por ambiente** (dev, staging, prod) bajo AWS Organizations, no solo VPCs separadas. Esto aísla de verdad los datos de salud/PEP y los certificados \[HOMOLOG\] de Code100 respecto de producción.  
* Roles IAM específicos por ambiente, asumidos vía OIDC desde GitHub Actions — nunca credenciales compartidas.

### **3.2 Branching y despliegue**

feature/\*  →  PR con checks obligatorios  →  develop  →  staging (auto-deploy)  
                                                         ↓ aprobación manual  
                                              main  →  production (auto-deploy tras aprobación)

* **Build una sola vez, promocioná el mismo artefacto** (Docker image / paquete Lambda) entre staging y producción. No re-buildear por ambiente: esto es clave para la trazabilidad probatoria (el hash que se firma/testea en staging debe ser el mismo que corre en prod).

### **3.3 Configuración de GitHub Environments**

| Environment | Deploy trigger | Aprobadores requeridos | Secrets propios |
| ----- | ----- | ----- | ----- |
| `dev` | push a `develop` | ninguno | credenciales sandbox Bancard/Code100 |
| `staging` | merge a `develop` | 1 (QA lead) | credenciales \[HOMOLOG\] Code100, sandbox Bancard, datos sintéticos |
| `production` | merge a `main` | 2 (tech lead \+ compliance/negocio) \+ *wait timer* 15-30 min | credenciales productivas, rotadas vía Secrets Manager |

### **3.4 Datos de prueba**

* Staging jamás debe contener PII/salud/PEP real: usar datos sintéticos o anonimizados (coherente con el punto 84 "privacidad desde el diseño").  
* Las integraciones de Bancard, Code100 y Entrust/Onfido deben correr contra sus ambientes de **homologación/sandbox** en dev/staging; solo producción usa credenciales reales.

---

## **4\. Pasos concretos a seguir (roadmap de implementación)**

**Fase 0 — Preparación (semana 1\)**

1. Crear estructura de cuentas AWS (dev/staging/prod) en AWS Organizations.  
2. Definir política de branching (trunk-based simplificado arriba) y documentarla en `CONTRIBUTING.md`.

**Fase 1 — Seguridad base en el repo (semana 1-2)** 3\. Activar GitHub Secret Scanning \+ Push Protection en el repositorio. 4\. Instalar Gitleaks como pre-commit hook y como job de CI. 5\. Configurar branch protection en `main` y `develop`: revisión obligatoria, checks obligatorios, commits firmados. 6\. Definir CODEOWNERS para los módulos de firma (Code100), pago (Bancard) y KYC/PEP.

**Fase 2 — Pipelines de CI (semana 2-3)** 7\. Crear workflow de GitHub Actions: lint → tests unitarios → Semgrep (SAST) → Trivy (SCA/contenedor/IaC) → build de artefacto único. 8\. Agregar los tests de "reglas atómicas" descritos en la sección 1 como *required status checks*. 9\. Configurar Dependabot para dependencias y GitHub Actions.

**Fase 3 — Entornos y despliegue (semana 3-4)** 10\. Crear los tres GitHub Environments (dev/staging/production) con sus reviewers y secrets. 11\. Configurar OIDC entre GitHub Actions y los roles IAM de cada cuenta AWS (eliminar access keys estáticas). 12\. Implementar el workflow de "build once, promote artifact" (por ejemplo, empujar la misma imagen a ECR de staging y luego re-taggearla/promoverla a ECR de producción sin rebuild). 13\. Añadir DAST (OWASP ZAP) como job que corre automáticamente contra staging tras cada deploy.

**Fase 4 — Evidencia y auditoría (semana 4-5)** 14\. Configurar exportación del audit log de GitHub (o activar GHAS/Enterprise) hacia el bucket S3 con Object Lock ya definido en tu arquitectura de integraciones. 15\. Vincular cada release/tag de GitHub con el hash de build y dejarlo trazado junto a los hashes de Solicitud/FIPF/póliza (mismo criterio de correlativos que ya usás en el resto del sistema).

**Fase 5 — Piloto y ajuste (semana 5-6)** 16\. Ejecutar un pentest inicial sobre staging antes de habilitar producción real. 17\. Correr un ciclo completo de "200 casos de prueba" (igual que en el plan del asistente IA) pero aplicado al flujo de contratación, incluyendo casos de fallo de firma/pago para validar rollback. 18\. Revisar y aprobar formalmente antes de habilitar el primer deploy a producción con datos reales.

**Recurrente** 19\. Repetir Fase 3-4 cada vez que se sume una integración nueva (ComplyAdvantage, Sumsub, etc.), igual que tu regla de "actualizar producto \= repetir pasos 2,3,5,10,12" del asistente IA.

