# Métricas de la encuesta + sanitización post-reunión

Objective: new `metrics` module (KPIs + interactive dashboards over survey responses, live via version polling) and the client-reported fixes (audit labels, venue images, "null" in UI/CSV).
Branch: `dev-santi`. Delivery: one commit per cohesive file/unit (`tipo(modulo): descripción`), push at the end. Runners: backend `npx jest` + `npm run test:e2e`; frontend `tsc -b`, lint, build, `check:*`; `e2e/` Playwright (parent only).
Full plan: `C:\Users\Santiago Ayala\.claude\plans\c-users-santiago-ayala-music-audio-1-me-crispy-orbit.md`.

## Specs

- S1 Métricas works for any campaign and its questions; KPIs are declarative (`SurveyKpi.definicion`, matched by option `valor`), editable from the admin panel.
- S2 Dimensions available for cross-tabs: etapa, ventana, sexo, disciplineType, disciplina, categoría, localidad, departamento, zona (CAPITAL = locality "Formosa"), pregunta:<id>, fecha.
- S3 Every cell/row with fewer than `UMBRAL_K_ANONIMATO` (5) responses is suppressed; a suppressed cell also suppresses its row total.
- S4 Dashboards refresh automatically: frontend polls `GET /metrics/survey/:id/version` every 10 s; heavy queries re-run only when the version changes.
- S5 Chart builder: pregunta X, desglose Y opcional, tipos torta / barras / barras apiladas / líneas en el tiempo / dispersión (solo pregunta×pregunta o tiempo); compare mode; export PNG/CSV.
- S6 Roles: `METRICS_READ` = `DASHBOARD_READ` roles (admins + COORDINADOR); KPI editing = `SURVEY_MANAGE`.
- S7 Public survey wizard sends `localityId` (Departamento → Localidad selects from new public `GET /localities`).
- S8 Audit page uses the real API with Spanish labels for action and entity, filters and pagination.
- S9 Venue/news images load when frontend origin ≠ API origin (CORP `cross-origin` on image routes), one retry client-side, nginx burst for image routes.
- S10 No "null"/"undefined" rendered in UI; CSV exports write empty cells and enum labels.
- L1 user request (verbatim, 2026-11-15): "Quiero que implementes ese modulo de metricas, y que este conectado directamente con las respuestas obtenidas de la encuesta. Todo debe ser automatizado y ... debo poder interactuar con los dashboards ... teniendo la capacidad de seleccionar diversos campos que se vean reflejados en las graficas, que deben variar entre torta, barras, dispercion o cualquier otro ... por cada archivo en especifico debes hacer un commit descriptivo usando la convencion "feat(<modulo>): <funcionalidad agregada>"".

## Tasks

| ID | Scope | Route | Status | Commit |
|---|---|---|---|---|
| T0 | merge dev-ramiro | inline | done | see Log L3 |
| T1 | backend base: redis-cache, METRICS_READ + CAPITAL, /localities, survey filters, version counter | inline | done | see Log L3 |
| T2 | backend metrics module: SurveyKpi + migration, aggregation, service, controller, tests | inline | done | see Log L3 |
| T3 | seed: questions, KPIs, demo responses script | inline | done | see Log L3 |
| T4 | frontend: locality in wizard, metrics api/hooks/rules + check:metrics | inline | done | see Log L3 |
| T5 | frontend: Métricas page, route/roles/menu | inline | done | see Log L3 |
| T6 | fixes: audit, images CORP, null-safe UI, CSV | delegated | done | see Log L3 |
| T7 | e2e tests, full suites, docs, push | inline | done | 3afd95a..8b7b01c |

## Log

- L2 2026-11-15: plan approved. Decisions: roles = DASHBOARD_READ; KPI editor in this iteration; CSV empty cells (test updated). SSE discarded: access token is header-only (`jwt.strategy.ts:22`).
- L3 2026-11-18: T0–T6 done and committed on dev-santi (merge c4c9221 → f6554e0). T6 delegated (writer reason: parallel unit, disjoint surface); integration fixes inline: check:cards regex for the new VenuePhoto retry, lone "-" no longer prefixed in CSV, native checkboxes → Checkbox (check:controls), Métricas added to e2e admin-nav table. Co-Authored-By dropped from commits per the user's global CLAUDE.md rule. Suites before e2e run: backend unit 227/227, backend e2e 948/948, frontend tsc/lint/build + 14 checks OK. Pending: isolated e2e run (api/desktop/mobile/empty), browser walkthrough (needs the user to log in in the pane), push.
- L4 2026-11-18: T7 done. Isolated e2e: api 166/166 (+1 skip); desktop 112/118 then the 6 affected specs re-run 82/82; mobile 109/118 then 82/82 on the affected specs; empty 32/32 (unchanged). Failures were the metrics KPIs spec (estudios is obligatoria, now answered) and e2e expectations broken by the dev-ramiro redesign (FilterPanel collapsed on mobile, DataTable cards on mobile, lowercase labels, "Mostrar contraseña" toggle, sr-only table caption); fixed in tests only, app code untouched. Manual browser walkthrough not done: the admin login is the user's; the metrics UI spec covers render, chart, live indicator and suppression.
