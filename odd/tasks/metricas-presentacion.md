# Métricas: rediseño visual, Destacados y modo presentación

Objective: rework `/admin/metricas` after the client template (stat tiles, period switch, donut, area, horizontal bars, heatmap), add admin-defined "Destacados" (ranked needs, plain-language phrases with a minimum sample) and a presentation mode; fix overlapping category labels.
Branch: `dev-santi`. Delivery: one commit per unit (`tipo(modulo): descripción`, no Co-Authored-By), push at the end. Runners: backend `npx jest` + `npm run test:e2e`; frontend `tsc -b`, lint, build, `check:*`; `e2e/` Playwright (parent only, never two runs at once).
Full plan: `C:\Users\Santiago Ayala\.claude\plans\snuggly-tickling-sedgewick.md`.

## Specs

- S1 Bar charts never overlap category labels: horizontal layout when there are more than 5 categories or a label longer than 14 chars, axis width from the longest label (max 180 px), truncation with full name in tooltip, sorted by total, first 15 rows plus "Ver todas".
- S2 `SurveyHighlight` (Destacado): admin-defined ranking over option `valor`s (`{ opciones: string[], top: 3..5 }`), `campaignId` null = reusable; read with `METRICS_READ`, manage with `SURVEY_MANAGE`; every cell goes through the k-anonymity threshold (5); never an "Otras"/remainder bucket.
- S3 Plain-language phrases ("4 de cada 10", "casi la mitad", "la mayoría") only when the base has at least `MINIMO_PARA_FRASES` = 30 responses; below it: "Todavía hay pocas respuestas para sacar conclusiones". Always "sobre N respuestas · fecha".
- S4 Layout after the template: stat tiles (alternating primary/secondary borders, sparkline), period switch Día/Semana/Todo + date range, Destacado card + area of evolution, donut with legend and total, horizontal bars by territory, heatmap departamento × opción; current builder kept under "Explorar en detalle" ("Explorar las respuestas"), suppression notes under "Detalle técnico". Keep `data-testid` `metricas-total` and `metrics-chart`.
- S5 Presentation mode at `/admin/metricas/presentar?campania=`: same roles as Métricas, large type, no filters/editors, still live.
- S6 Seed: multiple-choice needs question (`nec_*` valores) and the seed Destacado "Lo que más necesitan los deportistas es:".
- S7 Series palette without `destructive-500`.
- L1 user request (verbatim, 2026-11-19): "Para los graficos, quiero que hagas nuevamente un plan de implementacion que contemple los cambios que se deben realizar, los riesgos a tener en cuenta para esos cambios categorizando de mayor a menor riesgo. El redisenio de la parte visual de los graficos debe seguir una estructuracion parecida a la imagen de la plantilla proporcionada. Me gustaria que el enfoque de las metricas cambiara, dirigiendose sutilmente a mas hacia la politica, por ejemplo, que se pueda sacar un analisis de los usuarios que respondieron la encuesta (funcionalidad normal): "Lo que mas necesitan los deportistas es:" y ahi anexar segun las metricas evaluadas. [...] Ademas de todo esto, tambien requiero que soluciones este error visual o que gestiones los espacios de forma diferente, porque al filtrar los datos estadisticos con grafico de barras, por localidad, sucede esta superposicion de los nombres, y queda horrible."

## Tasks

| ID | Scope | Specs | Route | Status | Commit |
|---|---|---|---|---|---|
| T1 | horizontal bars, label rules, palette | S1, S7 | inline | done | ad0361b, 1eff517, 68fedf9 |
| T2 | SurveyHighlight model + migration | S2 | inline | done | 89a08cf |
| T3 | ranking + phrase minimum (aggregation) + unit tests | S2, S3 | inline | done | 82a07dc, 24506c4, f0c7894 |
| T4 | highlight endpoints, permissions, e2e with Prisma double | S2 | inline | done | 7de8ede, ac9dfc4, 4bfdb3f, 093be1c, 3727568, 521ab17 |
| T5 | seed: needs question + seed highlight | S6 | inline | done | 4f5717d, 8214958, 94e7f6f |
| T6 | frontend types/api/hooks + phrase rules + checks | S2, S3 | inline | done | bf81b5b..bad1c95, 1e5b384 |
| T7 | stat tiles, period switch, highlight card, donut, area, heatmap, editor | S3, S4 | inline | done | 3da7154..d2ff53d, badf2a0..6341d20 |
| T8 | page reorganized + presentation mode + route | S4, S5 | inline | done | 397c3b9, 3b440b4, 9e0dfdb |
| T9 | e2e, docs, full suites, push | all | inline | done | 3d2f81a, 51145d8, 9763358 |

## Log

- L2 2026-11-19: plan approved by the user (ExitPlanMode). Route: all inline (no writer reason: sequential, shared files `metricsRules.ts`/`check-metrics.mjs`). Risk items: 1 (new table, additive migration), 2 (k-anonymity on new aggregates) → independent check of the backend unit before closing.
- L3 2026-11-19: privacy finding while writing the ranking (risk #1): the module published raw totals next to suppressed cells, so a cell of 1-4 could be derived by subtraction (KPI 6 of 10 revealed 4 "sin atención"; a UNICA cross row with one hidden cell plus the locality total known from the overview). Fixed with `complementoRevela`/`publicarKpi` (KPI numerator hidden when den − num is 1..4) and `suprimirComplementaria` (secondary suppression per row for UNICA questions); highlights use both. Two existing e2e expectations changed on purpose (Pirané row, 6-of-10 KPI). Residual risk, not addressed: cross-dimension linkage (a suppressed cell derivable from the same option's total in another cut); full 2D protection needs rounding or audited suppression — decision for the user.
- L4 2026-11-19: other fixes found during verification: reusable highlights whose options are absent from the campaign are not shown (plan: "si una edición no la incluye, el titular no aparece"); enum dimensions (zona, etapa, ventana, sexo, tipo) now carry Spanish labels instead of codes. Visual verification through the isolated e2e stack (admin login on evita-dev needs the password in `.env`, not readable): captures desktop/mobile/presentation reviewed; fixed tile overlap, donut layout, thin bars, huge legends, mobile horizontal overflow (missing `min-w-0`). Metrics UI e2e 5/5 desktop and mobile.
- L5 2026-11-19: full battery green. Frontend tsc/lint/build + 14 check:* OK. Backend unit 246/246, e2e 957/957; backend lint fails only on 4 files untouched by this feature (pre-existing prettier formatting: forbidden-secrets.ts, dni.validator.spec.ts, dashboard.service.ts, test/mocks/prisma-territorial.ts). Isolated e2e: api 167 (+1 skip), desktop 120/120, mobile 120/120, empty 32/32. Temporary capture spec removed before the full run.
