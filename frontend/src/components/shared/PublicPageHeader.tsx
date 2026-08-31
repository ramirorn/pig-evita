// ===========================================
// PublicPageHeader — encabezado de las páginas públicas de listado
// ===========================================
import type { ReactNode } from 'react';

interface PublicPageHeaderProps {
  title: string;
  description?: string;
  /** Se pinta dentro del cuadrado azul, a la izquierda del título. */
  icon?: ReactNode;
  /**
   * Contenido alineado a la derecha, en la misma línea que el título:
   * un buscador, un contador. En pantallas angostas baja debajo.
   */
  actions?: ReactNode;
}

/**
 * Encabezado de una página pública de listado.
 *
 * Reemplaza al `PageHero`, que ocupaba entre 80 y 112 píxeles de padding
 * vertical más el bloque de texto para repetir un título que ya está en el menú.
 * En un listado eso empujaba el contenido media pantalla hacia abajo: el
 * visitante llegaba buscando noticias, sedes o resultados y lo primero que veía
 * era una franja de color.
 *
 * El `<h1>` vive acá: cada página necesita exactamente uno, y al sacar el hero
 * los listados se quedaban sin encabezado principal, con el esquema del
 * documento arrancando en `h3`.
 *
 * ⚠️ **Es distinto de `PageHeader`**, que es el del back-office y lo usan 16
 * pantallas del panel: aquel es más chico, con el icono en degradé y sin la
 * tipografía display. No unificarlos es deliberado — el panel y el sitio público
 * tienen densidades distintas—, pero conviene saber que existen los dos.
 *
 * Los filtros y las pestañas **no** son `actions`: van debajo del encabezado, en
 * el cuerpo de la página, porque pertenecen al listado y no al título.
 */
export function PublicPageHeader({
  title,
  description,
  icon,
  actions,
}: PublicPageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col justify-between gap-6 md:flex-row md:items-center">
      <div>
        <h1 className="font-display flex items-center gap-3 text-3xl font-extrabold tracking-tight text-primary-800">
          {icon && (
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-800 text-white">
              {icon}
            </span>
          )}
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-2xl text-sm text-primary-600">
            {description}
          </p>
        )}
      </div>

      {actions && <div className="w-full md:w-auto">{actions}</div>}
    </div>
  );
}
