-- Foto principal de cada sede.
--
-- `venues.image_key` guarda la CLAVE del objeto en MinIO (prefijo `venues/`),
-- nunca una URL: el bucket es privado y la imagen se sirve por
-- `GET /api/v1/venues/:id/image`, que hace stream del objeto. NULL = sin foto.
-- Columna nueva y NULL-able: la migracion es aditiva y no toca filas existentes.
ALTER TABLE "venues" ADD COLUMN "image_key" TEXT;
