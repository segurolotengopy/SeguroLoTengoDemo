# Política de despliegue

**Vigente desde el 20 de agosto de 2026.** Se aplica a **todo** despliegue de
SeguroLoTengo, sin excepción por tamaño del cambio: un cambio de una línea
recorre la misma cadena que un lote entero.

## La cadena

Cinco pasos, en este orden. Ninguno se saltea y ninguno se reordena.

| # | Paso | Herramienta | Corta el despliegue si… |
| :- | :---- | :---------- | :----------------------- |
| 1 | Calidad | `npm run verify` | typecheck, lint o alguno de los tests fallan |
| 2 | Vulnerabilidades | Snyk | hay un CVE de dependencia sin arreglar y sin entrada vigente en `.snyk`, o un hallazgo de IaC alto o crítico |
| 3 | Guardar | `git push` + PR a `main` | — |
| 4 | Seguridad en GitHub | CI (4 jobs) + alertas del repo | cualquier job rojo, o una alerta de Dependabot abierta de severidad alta |
| 5 | Publicar | Amplify Hosting | — |

### 1. Calidad

```bash
npm run verify
```

Es lo que CLAUDE.md ya exigía antes de cualquier commit (typecheck + lint +
tests). Acá se repite porque un despliegue puede juntar trabajo de varias
ramas, y la combinación puede fallar aunque cada rama pasara por separado.

### 2. Vulnerabilidades (Snyk)

```bash
npm run seguridad
```

Corre las dos superficies que el plan de la organización habilita hoy:

- **Dependencias** (`snyk test`) — CVEs en `package-lock.json`, bloquea desde `low`.
- **Infraestructura** (`snyk iac test infra/`) — configuración insegura en
  Terraform, bloquea desde `high`.

El umbral de IaC es más alto a propósito, y por la misma razón que el job de
Trivy en CI usa `HIGH,CRITICAL`: `infra/` describe un entorno de demostración
cuyo endurecimiento completo es una tarea de Go-Live, no una deuda a saldar en
cada despliegue. **Hay un hallazgo MEDIA tolerado hoy**, y conviene tenerlo a
la vista en vez de enterrado:

| Regla | Recurso | Estado |
| :---- | :------ | :----- |
| SNYK-CC-TF-125 | `aws_dynamodb_table.expedientes` sin Point-in-Time Recovery | Aceptado hasta Go-Live (2026-08-20). Fundamento completo en `infra/dynamodb.tf`, junto al recurso. |

> Los ignores **en línea** de Snyk IaC (`# snyk:ignore:REGLA`) no funcionan en
> la versión del CLI que usamos: se probaron pegados al recurso y el análisis
> los cuenta como 0 ignorados. Por eso el hallazgo se tolera por umbral y se
> anota acá y en el `.tf`, en vez de con un directivo que no hace nada.
> `.snyk` **sí** funciona para dependencias.

`snyk code test` (SAST) **no está disponible**: el plan de la organización
`andresalberdi` no lo incluye. Lo cubre Semgrep en CI, con las reglas propias
de `.semgrep/segurolotengo.yml` que codifican las reglas inviolables de
CLAUDE.md — que es de todos modos más específico que un SAST genérico.

#### Qué hacer con un hallazgo

En este orden, y no se baja de escalón sin agotar el anterior:

1. **Actualizar.** Si hay versión con el arreglo y el proyecto la puede tomar, se toma.
2. **Evaluar contra este código.** Muchos avisos traen condiciones. Se lee el
   aviso completo, no el título, y se verifica si la condición se cumple acá.
3. **Mitigar por configuración.** Si no hay upgrade posible, se cierra la
   superficie. **La mitigación se verifica empíricamente** — prueba y control
   sobre el mismo build, no la palabra de la documentación.
4. **Aceptar con vencimiento.** Solo lo que sobrevivió a los tres pasos
   anteriores va a `.snyk`, con fundamento escrito, verificación y `expires`
   a 90 días.

> **Restricción que va a reaparecer:** el proyecto está fijo en **Next 15**
> por el límite de Amplify Hosting. Snyk va a seguir proponiendo la línea 16.x
> como único arreglo para los CVE de Next. Esa recomendación **no es
> aplicable**: hay que ir por los pasos 2 y 3.

`.snyk` no es un silenciador. Cada entrada vence, y cuando vence el análisis
vuelve a fallar a propósito, para forzar la revisión del fundamento.

### 3. Guardar en GitHub

Rama de trabajo → `push` → PR contra `main`. **Nunca se commitea directo a
`main`**: `main` es lo que Amplify despliega en PRODUCTION, así que un commit
directo es un despliegue sin revisión.

### 4. Revisión de seguridad en GitHub

Los 4 jobs de `.github/workflows/ci.yml` tienen que estar en verde:

| Job | Cubre |
| :-- | :---- |
| `calidad` | typecheck, lint, tests |
| `secretos` | Gitleaks sobre el **historial completo** |
| `vulnerabilidades` | Trivy: CVEs de dependencias e IaC de `infra/` |
| `sast` | Semgrep: reglas propias + `p/typescript`, `p/react`, `p/secrets` |

Además se miran las **alertas de Dependabot** del repo.

**Trivy y Snyk se solapan a propósito.** No es redundancia por descuido: son
bases de datos de vulnerabilidades distintas y una encuentra cosas que la otra
no. Snyk corre local y temprano (falla en segundos, antes del push); Trivy
corre en CI y es el que bloquea el merge.

Code scanning y secret scanning **nativos de GitHub** están apagados y así
quedan: en repos privados requieren GitHub Advanced Security, que es un pago
aparte. Gitleaks y Semgrep en CI cubren lo mismo sin ese costo.

### 5. Publicar en Amplify

El despliegue lo dispara el **merge a `main`**: la rama `main` de la app
`slt-demo-segurolotengo` (`d3su6j17axjeyl`) tiene `autoBuild` encendido, así
que no hay comando de deploy que correr a mano. Después del merge se mira que
el job de Amplify termine en `SUCCEED` y se prueba el sitio desplegado.

**Amplify no es el destino de este proyecto por casualidad, y no se cambia sin
decisión explícita.** La aplicación tiene 41 Route Handlers y depende en
runtime de DynamoDB, S3, Secrets Manager, Rekognition, Textract y SES: no es
un sitio estático, y moverla a otro hosting significaría o partir la
aplicación de sus datos o replicar toda la infraestructura de AWS.

## Lo que esta política no cubre

- **Cambios de infraestructura** (`terraform apply`). Tienen su propio camino y
  su propia decisión de costo. Un hallazgo de Snyk IaC se reporta acá, pero se
  arregla allá.
- **Los tres documentos con consecuencia legal.** Si el cambio toca la
  Solicitud, el FIPF o el Certificado de Cobertura Provisional, antes de esta
  cadena corre el checklist de CLAUDE.md → "Checklist antes de cerrar una tarea".
