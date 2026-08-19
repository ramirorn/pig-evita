# PROCESO.md — Bitácora del desarrollo

> **Producto:** Plataforma Integral de Gestión — Juegos Evita Formosa
> **Propósito:** Este documento es la **bitácora viva** del proyecto. Aquí se registra el proceso real de construcción: qué se investigó, qué prompts se usaron, qué código produjo el agente, qué correcciones manuales fueron necesarias, y qué se aprendió al final.
>
> **Regla de oro:** todo lo que un futuro miembro del equipo (o auditor) necesitaría para reconstruir el "por qué" de una decisión debe estar acá. La trazabilidad prompt → código → corrección es no negociable.

---

## 1. Investigación

> Registrar la investigación previa que fundamenta las decisiones tomadas: benchmarking, análisis de la Secretaría de Deportes, consultas a stakeholders, revisión de sistemas similares.

### 1.1 Contexto del dominio

*(pendiente de completar)*

### 1.2 Referencias consultadas

*(pendiente de completar — links, documentos, entrevistas)*

### 1.3 Restricciones identificadas

*(pendiente de completar — legales, técnicas, de infraestructura del Ministerio)*

---

## 2. Especificación y planificación

> Registrar el proceso de definición del alcance del MVP y las decisiones arquitectónicas mayores.

### 2.1 Decisiones de alcance

*(pendiente — por qué se dejó afuera MinIO, dashboard, reportes, etc.)*

### 2.2 Decisiones arquitectónicas (bitácora complementaria a `plan.md`)

*(pendiente — discusiones que llevaron a los ADR)*

### 2.3 Validación de la spec con el usuario

*(pendiente — fecha, participantes, cambios propuestos, aprobación)*

---

## 3. Setup de infraestructura

> Registrar la instalación paso a paso del stack de desarrollo y cualquier tropiezo enfrentado.

### 3.1 Preparación del entorno local

*(pendiente — versión de Node instalada, Docker Desktop, editor)*

### 3.2 Levantamiento del Docker Compose

*(pendiente — comandos ejecutados, tiempo, errores)*

### 3.3 Configuración de Prisma y primera migración

*(pendiente)*

### 3.4 Configuración de CI/CD

*(pendiente)*

---

## 4. Desarrollo

> **Formato obligatorio:** por cada tarea (T01, T02, ...) de `tasks.md` completada, se agrega un bloque usando la plantilla de abajo. Nada se da por sentado: si se copió un prompt del chat, se pega; si el agente generó código que luego se editó a mano, se documenta.

### Plantilla por tarea

Copiar el bloque siguiente y completarlo cada vez que se cierra una tarea:

```
### T## — <Título de la tarea>

- **Fecha:** YYYY-MM-DD
- **Responsable:** <nombre>
- **Historia(s) cubierta(s):** HU-XX
- **Duración estimada / real:** Xh / Yh

#### Prompt utilizado

> Pegar el prompt (o resumen) enviado al agente de IA. Si hubo varios intentos,
> incluir los iterativos más significativos.

#### Código generado

- **Archivos creados/modificados:**
  - `backend/src/modules/xxx/xxx.service.ts`
  - `frontend/src/hooks/useXxx.ts`
- **Resumen del cambio:** <qué hizo el código generado>

#### Correcciones manuales

> Todo lo que el humano tuvo que ajustar sobre lo generado. Aunque sea trivial,
> se documenta. Ejemplos: cambiar nombre de variable, corregir tipo, agregar
> manejo de un caso borde no cubierto por el prompt, ajustar estilos.

- <correción 1 con path y línea>
- <correción 2>

#### Verificación (DoD)

- [ ] Criterio 1 verificado (cómo)
- [ ] Criterio 2 verificado (cómo)

#### Notas / aprendizajes

> Cualquier observación que ayude al equipo en tareas futuras.
```

---

### T01 — Estructura del monorepo y `.gitignore`

*(pendiente de ejecución — ver `tasks.md`)*

---

### T02 — `docker-compose.dev.yml` con Postgres 16 y Redis 7

*(pendiente de ejecución — ver `tasks.md`)*

---

<!--
Repetir bloque de plantilla arriba por cada tarea T03..T34 completada.
Se recomienda mantener las tareas cerradas en orden cronológico ascendente.
-->

---

## 5. Conclusiones

> Al cierre del MVP (T34), completar esta sección con la mirada retrospectiva del equipo.

### 5.1 Lo que funcionó bien

*(pendiente)*

### 5.2 Lo que revisaríamos

*(pendiente — decisiones que en retrospectiva cambiaríamos)*

### 5.3 Deuda técnica asumida

*(pendiente — atajos tomados conscientemente, con propuesta de cuándo/cómo pagarla)*

### 5.4 Métricas finales del MVP

- Tareas completadas: _ / 34
- Tiempo total invertido: _ horas
- Correcciones manuales / cambios generados por IA: _ (%)
- Bugs detectados en QA vs. producción: _ / _

### 5.5 Recomendaciones para la V2

*(pendiente — priorización sugerida de lo que quedó Out of Scope)*
