-- S21 — inscripcion de planteles completos (equipo con titulares y suplentes).
--
-- `disciplines.titulares` y `disciplines.max_suplentes` son la composicion del
-- plantel que se carga en la inscripcion: cuantos titulares exige la disciplina
-- y cuantos suplentes admite como maximo.
--
-- ⚠️ NO reemplazan a `min_players` / `max_players` y no se derivan de ellos. Ese
-- par responde a "con cuanta gente se puede competir" (el reglamento en la
-- cancha). Este par responde a "que plantel hay que cargar en la inscripcion".
-- Son preguntas distintas y en varias disciplinas dan numeros distintos:
-- unificarlas romperia una de las dos validaciones sin que ningun test lo note.
--
-- Las dos columnas son NULL-ables a proposito: solo tienen sentido en
-- `type = 'EQUIPO'`, y quedan en NULL para todas las filas existentes. Eso es
-- deliberado: `POST /inscriptions/team` rechaza con 400 explicito pidiendo
-- configurar la disciplina antes que adivinar un tamano de plantel. No se pone
-- DEFAULT porque cualquier numero por defecto seria una invencion que despues
-- nadie revisa.
--
-- `team_members.is_substitute` distingue titular de suplente dentro del plantel.
-- Hasta ahora el plantel entraba como una bolsa plana y la planilla de partido
-- no podia reconstruirse desde la base. DEFAULT false para que las filas
-- existentes queden como titulares, que es lo que de hecho son.
--
-- ⚠️ PENDIENTE DE APLICAR. Escrita a mano siguiendo el formato que emite
-- `prisma migrate diff --script` (sin base: no habia Postgres levantado al
-- momento de escribirla), mismo procedimiento que
-- `20260915120000_add_survey_module` y
-- `20260831140000_add_external_news_and_sync_state`. Antes de darla por buena
-- hay que correr `npm run db:migrate:deploy` contra el Postgres de
-- docker-compose.dev.yml y verificar con `npx prisma migrate status`.

-- AlterTable
ALTER TABLE "disciplines" ADD COLUMN     "titulares" INTEGER,
ADD COLUMN     "max_suplentes" INTEGER;

-- AlterTable
ALTER TABLE "team_members" ADD COLUMN     "is_substitute" BOOLEAN NOT NULL DEFAULT false;
