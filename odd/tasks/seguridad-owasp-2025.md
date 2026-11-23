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
- S3 (decisión del usuario, 2026-11-22: "Limitar a su territorio (Recomendado)"): resultados y
  sedes/competencias sólo de su departamento o zona para los roles territoriales; noticias, calendario y
  encuesta quedan para admin provincial y super admin (VULN-07, VULN-08).
- S4: al terminar, cada ficha del informe cambia `**Estado:** Pendiente` por Mitigado / Mitigado parcialmente /
  Aceptado / Requiere decisión, con el commit.

## Tasks

| ID | Unidad | VULN | Ruta | Estado | Commit |
|---|---|---|---|---|---|
| T1 | A — Sesión y autenticación | 05, 22 (bloqueo por cuenta), 23, 37, 38, 39, 45, 47, 25 (auth/users/pino) | delegado (Opus) | pendiente | |
| T2 | B — Privacidad de la encuesta y métricas | 01, 18, 19, 20, 21, 33, 35, 36, 40, 26 (reportes) | delegado (Opus) | pendiente | |
| T3 | C — Validación, cargas y errores | 10, 24, 27, 34, 43, 25 (participants/filtro), 26 (documentos) | delegado (Opus) | pendiente | |
| T4 | E — Alcance territorial y superficie pública | 06, 28, 32, 44, 25 (inscriptions) | delegado (Opus) | pendiente | |
| T5 | D1 — Configuración y despliegue (sin instalar paquetes) | 02, 03, 09, 11, 12, 13, 14, 15, 16, 17, 42, 46, 35 (nginx) | delegado (Opus), Ola 2 | pendiente | |
| T7 | F — Alcance territorial de escritura | 07, 08 | delegado (Opus), Ola 2 | pendiente | |
| T8 | D2 — Dependencias | 04, 29, 30, 31, 41, 22 (almacenamiento) | delegado (Opus), Ola 3 (sola) | pendiente | |
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
