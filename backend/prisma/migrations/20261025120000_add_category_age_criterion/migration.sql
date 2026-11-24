-- Criterio de edad de cada categoría: por edad cumplida (AGE, el de siempre)
-- o por año de nacimiento (BIRTH_YEAR).
--
-- Aditiva para los datos existentes: todas las categorías quedan en AGE con
-- el rango que ya tenían. `min_age`/`max_age` pasan a NULL-ables porque una
-- categoría por año de nacimiento no tiene rango de edad, y el CHECK asegura
-- que cada criterio tenga completo su propio par.
CREATE TYPE "AgeCriterion" AS ENUM ('AGE', 'BIRTH_YEAR');

ALTER TABLE "categories"
  ADD COLUMN "age_criterion" "AgeCriterion" NOT NULL DEFAULT 'AGE',
  ADD COLUMN "min_birth_year" INTEGER,
  ADD COLUMN "max_birth_year" INTEGER,
  ALTER COLUMN "min_age" DROP NOT NULL,
  ALTER COLUMN "max_age" DROP NOT NULL;

ALTER TABLE "categories" ADD CONSTRAINT "categories_age_criterion_range_check" CHECK (
  ("age_criterion" = 'AGE' AND "min_age" IS NOT NULL AND "max_age" IS NOT NULL)
  OR
  ("age_criterion" = 'BIRTH_YEAR' AND "min_birth_year" IS NOT NULL AND "max_birth_year" IS NOT NULL)
);
