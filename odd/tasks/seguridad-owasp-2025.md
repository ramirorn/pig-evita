# Seguridad OWASP Top 10:2025 — mitigación del relevamiento

Objetivo: mitigar los 47 hallazgos de `documentacion/seguridad/relevamiento-owasp-2025.md` evaluando el riesgo
de cada cambio. Rama `dev-santi`. Estrategia: olas por unidad con superficies disjuntas (Ola 1 en paralelo:
A, B, C, E; Ola 2: D, que toca dependencias y despliegue). Runner: jest (backend), `check:*`/tsc/lint/build
(frontend), Playwright e2e aislado (lo corre sólo el orquestador al final).

## Specs

- S1 (usuario, 2026-11-22): "Tu tarea posterior a la redaccion va a ser MITIGAR todas esas vulnerabilidades,
  siempre evaluando el RIESGO POTENCIAL a cambiar/agregar/quitar cosas del codigo para no afectar la integridad
  del proyecto actual."
- S2: cada hallazgo se mitiga según la "Mitigación propuesta" de su ficha en el informe, salvo que el riesgo de
  mitigar sea mayor que el del hallazgo; en ese caso se aplica una mitigación parcial o se acepta el riesgo,
  con la justificación escrita.
- S3 (decisión del usuario, 2026-11-22: "Limitar a su territorio (Recomendado)"; precisada el 2026-11-23:
  "Elige la primera opcion, la recomendada"): competencias, noticias, calendario y encuesta sólo para admin
  provincial y super admin (las competencias no tienen territorio en el modelo); sedes de los admins
  territoriales sólo de su departamento/zona; resultados de los admins territoriales sólo de partidos en sedes
  de su territorio; árbitros sin cambio (no tienen alcance territorial), riesgo aceptado y documentado.
- S5 (usuario, 2026-11-23): "me gustaria que guardes en memoria todas estas decisiones para un posterior
  documento tecnico explicativo de todas las vulnerabilidades, niveles de riesgos, mitigaciones, tomas de
  decisiones (parciales/temporales/completas) para su analisis a profundidad una vez terminemos este
  relevamiento." Se guardan en Engram (`seguridad/decisiones-owasp-2025`) y en este Log.
- S4: al terminar, cada ficha del informe cambia `**Estado:** Pendiente` por Mitigado / Mitigado parcialmente /
  Aceptado / Requiere decisión, con el commit.

## Tasks

| ID | Unidad | VULN | Ruta | Estado | Commit |
|---|---|---|---|---|---|
| T1 | A — Sesión y autenticación | 05, 22 (bloqueo por cuenta), 23, 37, 38, 39, 45, 47, 25 (auth/users/pino) | delegado (Opus) | hecho | 78f8ada, 4e3d928 |
| T2 | B — Privacidad de la encuesta y métricas | 01, 18, 19, 20, 21, 33, 35, 36, 40, 26 (reportes) | delegado (Opus) | hecho | 5c7b88f, 324a95b, 9639289 |
| T3 | C — Validación, cargas y errores | 10, 24, 27, 34, 43, 25 (participants/filtro), 26 (documentos) | delegado (Opus) | hecho | a79de02, e981f4b, 9b518ba, dcea974 |
| T4 | E — Alcance territorial y superficie pública | 06, 28, 32, 44, 25 (inscriptions) | delegado (Opus) | hecho | 4e66dff |
| T5 | D1 — Configuración y despliegue (sin instalar paquetes) | 02, 03, 09, 11, 12, 13, 14, 15, 16, 17, 42, 46, 35 (nginx) | delegado (Opus), Ola 2 | hecho | fd0b2ee, 01f6ed4, f11df18 |
| T7 | F — Alcance territorial de escritura | 07, 08 | delegado (Opus), Ola 2 | hecho | e920d37, f4a650a |
| T8 | D2 — Dependencias | 04, 29, 30, 31, 41, 22 (almacenamiento) | delegado (Opus), Ola 3 (sola) | hecho | a68415b, a29f378 |
| T6 | Orquestador | Batería completa, informe actualizado, commits | inline | pendiente | |

Ruta: delegada por paralelismo (4 unidades independientes con superficies disjuntas, cada una de varios
archivos) y por el respaldo de contexto del orquestador.

## Log

- L1 2026-11-22 (usuario): "Bien, con respecto a esos relevamientos, lo que quiero hacer es, en base al TOP10 -
  OWASP mas reciente: https://top10.owasp.org/2025/ El relevamiento debe ser en base a este sitio proporcionado
  sobre las vulnerabilidades mas recientes y este documento que vimos en la materia de Ciberseguridad en el
  instituto. [...] Tu tarea es RECORRER TODA LA PLATAFORMA, tanto del lado publico como del administrador, y
  generar un DOCUMENTO TECNICO EXPLICATIVO con todas las vulnerabilidades encontradas [...] Que vulnerabilidad
  es / Nivel de riesgo / Donde se encuentra. El documento debe ser un MD. Tu tarea posterior a la redaccion va a
  ser MITIGAR todas esas vulnerabilidades, siempre evaluando el RIESGO POTENCIAL a cambiar/agregar/quitar cosas
  del codigo para no afectar la integridad del proyecto actual. [...] Para la indagacion y deteccion de
  vulnerabilidades, utiliza Opus 5.5, Delega a un modelo inferior [...] para la redaccion [...] Para la
  mitigacion, vuelve a Opus. El esfuerzo siempre en alto. Modo 'Automatico'."
- L2 2026-11-22: relevamiento hecho con 3 agentes Opus (SAST + SCA). El agente DAST fue frenado por las
  salvaguardas del proveedor; el usuario eligió "Sin DAST, documentado". Informe redactado por Sonnet: 47
  hallazgos únicos (1 crítico, 4 altos, 22 medios, 16 bajos, 4 informativos). VULN-01 confirmado por el
  orquestador en código y elevado a Crítico.
- L3 2026-11-22 (usuario, sobre VULN-07/08): "Limitar a su territorio (Recomendado)". Se agrega T7 (unidad F) para
  la Ola 2, después de B y C porque toca resultados y encuesta. D se parte en D1 (configuración, en paralelo con
  F) y D2 (dependencias, sola al final, porque reinstalar paquetes afecta las pruebas de las demás unidades).
- L4 2026-11-23 (usuario): "Continua donde te quedaste. Ten en cuenta el documento con el resumen que hiciste antes de
  terminar la sesion de ayer". Los agentes de la Ola 1 no se podían reanudar: se revisó lo que dejaron, se terminó
  inline con Opus y se commiteó por unidad. Los tests que los agentes habían dejado en RED (VULN-05, 23, 25, 33) se
  usaron como prueba de cada cambio.
- L5 2026-11-23 (usuario, VULN-07/08): "Elige la primera opcion, la recomendada. Pero me gustaria que guardes en
  memoria todas estas decisiones [...] La idea es charlar con mi grupo de desarrolladores [...] y con los clientes
  para ver como replantear esta logica de los roles (o de cualquier otra incongruencia que llegues a encontrar)."
  Decisiones guardadas en Engram (`seguridad/decisiones-owasp-2025`) y en la sección 10 del informe.
- L6 2026-11-23: D2. `npm audit fix` completo subía Jest a 30.5 y rompía `stats-localities` (import dinámico de
  pglite): se descartó y se aplicó `--omit=dev`. `npm ci` falló con EPERM (argon2.node bloqueado por el backend de
  desarrollo en :3001) y dejó node_modules a medias; se restauró con `npm install`.
- L7 2026-11-23: informe v1.1 con el estado de los 47 hallazgos (25 mitigados, 16 parciales, 5 aceptados, 1
  pendiente: VULN-28) y documentation.md con los cambios operativos.
