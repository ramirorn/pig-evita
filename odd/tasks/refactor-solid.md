# Refactor SOLID y mitigación de vulnerabilidades abiertas

Objective: refactor module by module, ordered by risk, applying SOLID where it improves maintainability or performance, closing the open items of `documentacion/seguridad/relevamiento-owasp-2025.md` and the `AGENTS.md` violations listed in `documentacion/analisis-buenas-practicas.pdf`.
Branch: `dev-lucas`. Delivery: one commit per step (`refactor(<módulo>): …`, `ci: …`, `test: …`), one PR per module to `develop`. Runners: backend `npm run lint:check`, `npm run build`, `npx jest`, `npm run test:e2e`; frontend `npm run lint`, `npm run build`, `npm run check:all`; `e2e/` Playwright against the isolated stack at the end of each module.

## Specs

- S1 Refactor por módulos, de mayor a menor riesgo: 0 red de seguridad, 1 inscripciones y participantes, 2 autenticación y usuarios, 3 encuesta y métricas, 4 competencias y resultados, 5 plataforma transversal, 6 reportes y documentos, 7 frontend administración, 8 frontend público.
- S2 Reutilizar los patrones existentes (funciones puras con spec al lado, módulos con varios providers, `ClienteFixture`, `prisma-selects`, `ScopeService`, hooks con key factories). Sin capa de repositorios y sin dependencias nuevas (`AGENTS.md` §8.5).
- S3 Rendimiento medido: los tests de presupuesto de consultas (`test/mocks/query-budget.ts`) fijan la línea base y cada módulo baja su techo.
- S4 Ninguna suite existente retrocede.
- S5 Los cambios funcionales (VULN-20, 23, 35) entran a `spec.md` y `tasks.md` antes de implementarse (`AGENTS.md` §1.1).
- L1 pedido del usuario (textual): "Enfocate en separar la refactorizacion en modulos, organiza por riesgo de mayor a menor y genera un paso a paso dentro de ese plan para la refactorizacion y mitigacion de vulnerabilidades."

## Tasks

| ID | Módulo | Alcance | Status | Commit |
|---|---|---|---|---|
| F0.1 | Red de seguridad | CI completo (backend unit + e2e, frontend lint/build/checks, Playwright en PR), acciones por SHA, Dependabot para Docker (VULN-15, VULN-16) | done | 1e85627 |
| F0.2 | Red de seguridad | `no-explicit-any` como aviso en backend y frontend | done | 51e63fd |
| F0.3 | Red de seguridad | Tests de presupuesto de consultas: `createTeam`, `generateFixture`, `metrics overview` con caché | done | 4b6eda6 |
| F0.4 | Red de seguridad | Dobles de Prisma con `createMany`, `createManyAndReturn` y `updateMany` | done | 7c9d5c2 |
| F0.5 | Red de seguridad | Este tracker; PDF del análisis con su nombre final | partial (PDF bloqueado por Acrobat) | 4010998 |
| M1 | Inscripciones y participantes | Reglas puras, `InscriptionQrService`, `InscriptionReviewService`, `TeamInscriptionsService` con escritura en lote, VULN-28 (ids internos) | pending | |
| M2 | Autenticación y usuarios | Tipado, throttler en Redis (VULN-22), `TokenService`, VULN-23, VULN-27, VULN-47 | pending | |
| M3 | Encuesta y métricas | `SurveyVersionCache`, división de `MetricsService`, caché antes que la base, VULN-20, VULN-35 | pending | |
| M4 | Competencias y resultados | Motores puros, `EngineFactory` con mapa, fixture en lote, condición de carrera | pending | |
| M5 | Plataforma transversal | `ConfigService`, `redact`, caché unificada, cursor común, VULN-13, 17, 29, 46 | pending | |
| M6 | Reportes y documentos | Definiciones de reporte, `where` tipados, `select` | pending | |
| M7 | Frontend administración | Formularios tipados, `useCrudPageState`, memoización, archivos por dominio | pending | |
| M8 | Frontend público | Hooks del mapa, uploader y noticias; `metricsRules` por dominio | pending | |

## Decisiones pendientes (equipo o cliente)

VULN-07 (árbitro ↔ partido), VULN-19 (alcance de COORDINADOR en métricas), VULN-20 (token o Turnstile), VULN-23 (forzar cambio a cuentas existentes), VULN-27 (retención de `audit_logs`), VULN-28 (qué datos de menores se publican), VULN-03/11 (topología y TLS), Vitest en el stack.

## Log

- L1 2026-11-24: plan aprobado. `dev-santi` mergeado en `dev-lucas` (2dd98a6). Arranca la Fase 0.
- L2 2026-11-24: línea base sobre el código sin tocar. Backend unit 309/309, e2e 1046 con 3-5 fallos que cambiaban en cada corrida; frontend lint/build y 14/14 checks OK. Causas de los fallos, ninguna del código productivo: (a) `seguridad-auth-rutas` importaba `app.module`, que valida el entorno al cargarse y falla sin `.env` (ce93f10); (b) los specs de auth hacen 10+ argon2 por test y bajo varios workers pasaban los 5 s de Jest (f56c1cd, timeout e2e 30 s). `lint:check` sin `--fix` destapó 8 errores de Prettier que el CI escondía (4528599).
- L3 2026-11-24: presupuesto de consultas medido (4b6eda6). Plantel de 16 = 68 consultas (meta M1 ≤ 8); fixture round robin de 16 = 244 (meta M4 ≤ 5); overview de métricas con caché = 1 (meta M3: 0). El spec de planteles simula `qrcode`: el render de PNG bajo Jest llevaba la suite a ~2 min y la hacía intermitente. Suites al cierre de la Fase 0: backend unit 309/309, e2e 1060/1060 (~78 s, antes ~176 s), lint 0 errores (15 avisos de `any`); frontend 28 avisos de `any`. Pendiente: Playwright nunca corrió en CI (necesita push), y renombrar el PDF del análisis cuando se cierre en Acrobat.
