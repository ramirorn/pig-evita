-- Sync de noticias: recorrido de lo más nuevo hacia atrás.
--
-- Antes el sync avanzaba desde `last_scanned_id` hacia arriba, 60 IDs por
-- corrida: una instalación nueva traía primero lo más viejo y tardaba varias
-- corridas en llegar a lo publicado ayer. Ahora lee en la portada del portal
-- cuál es la nota más nueva y recorre desde ahí hacia abajo. Si el hueco hasta
-- el piso es más grande que el tope por corrida, queda un tramo pendiente que
-- completan las corridas siguientes:
--
--   (-inf, last_scanned_id]                    cubierto (el piso)
--   (last_scanned_id, pending_top_id]          pendiente
--   (pending_top_id, highest_scanned_id]       cubierto (el frente)
--
-- Columnas nuevas y NULL-ables: la migración es aditiva. NULL en las dos
-- equivale al estado anterior (frente = piso, sin tramo pendiente).
ALTER TABLE "sync_state" ADD COLUMN "highest_scanned_id" INTEGER,
ADD COLUMN "pending_top_id" INTEGER;
