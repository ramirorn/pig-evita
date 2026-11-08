# Auditoria fixes

Objective: fix every finding of `documentacion/auditoria-funcional.md` (F-01..F-43, cheap observations) and remove each expected-failure marker once its test passes.
Branch: `dev-santi`. Delivery: work-unit commits, push at the end. Runners: backend `npx jest` + `npm run test:e2e`; frontend `tsc -b`, lint, build, `check:*`; `e2e/` Playwright against the isolated stack (run by the parent only, never concurrently).

## Specs

- S1 Each finding in `documentacion/auditoria-funcional.md` section 4 is fixed as its "Esperado" / "Arreglo sugerido" says, and the test that covers it (`knownBug(...)` in `e2e/tests`, `it.failing` in `backend/test`) passes without the marker.
- S2 Observations O-3, O-4, O-5, O-7, O-8 are addressed where a code/doc change applies; O-1, O-2, O-6 are design decisions on rate limits, documented, not changed.
- S3 No existing suite regresses (backend unit + e2e, frontend lint/tsc/build/checks, e2e api/desktop/mobile/empty).
- L1 user request (verbatim): "no te detengas hasta purgar la totalidad de los problemas figurados en el documento y en el diagnostico que vos mismo lograste obtener."

## Tasks

| ID | Findings | Route | Status | Commit |
|---|---|---|---|---|
| T1 | Backend validation/robustness: F-01, F-04, F-05, F-06, F-07, F-08, F-15, F-16, F-17, F-18, F-19, F-20, F-21, F-22, F-24, F-37 (DTO), F-43, O-3, O-4, O-5, O-7, O-8 | delegated (parallel unit) | done | see Log L3 |
| T2 | Competitions/results: F-09, F-10, F-11, F-12, F-13, F-14 (engines) | delegated (parallel unit) | done | see Log L3 |
| T3 | Frontend: F-14 (default format), F-26, F-27, F-28, F-29, F-30, F-31, F-32, F-33, F-34, F-36, F-37 (form), F-40, F-41, F-42 | delegated (parallel unit) | done | see Log L3 |
| T4 | Full e2e stack run, audit doc update | inline | done | see Log L3 |

## Log

- L2 2026-11-07: dev-ramiro merged into dev-santi (75686ae). Writer trigger (a): three independent units with disjoint edit surfaces, each several files. Parent owns git and the isolated e2e stack.
- L3 2026-11-07: T1/T2/T3 done. Integration fixes inline: bye rendering (`esPaseDirecto`), group label in standings, O-5 `forRoutes`, `fileKey` optional in the frontend type, and `participantIds` taken from `participant.id` (the inscription list does not project `participantId`; found by journey test 10). Suites: backend unit 212/212, backend e2e 900/900, frontend lint/tsc/build + 9 checks OK, e2e api 161+1 skip, empty 32/32, journey desktop+mobile 32/32.
