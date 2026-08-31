// ===========================================
// Footer Component
// ===========================================
import { Link } from 'react-router';
import { ShieldCheck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ROUTES } from '@/lib/constants';

/** Navegación pública. Espeja la del header y suma la acción principal. */
const ENLACES = [
  { label: 'Inicio', to: ROUTES.HOME },
  { label: 'Disciplinas', to: ROUTES.DISCIPLINES },
  { label: 'Noticias', to: ROUTES.NEWS },
  { label: 'Calendario', to: ROUTES.CALENDAR },
  { label: 'Sedes', to: ROUTES.VENUES },
  { label: 'Rankings', to: ROUTES.RANKINGS },
  { label: 'Inscripciones', to: ROUTES.INSCRIPTION, destacado: true },
];

interface DatoDeContacto {
  Icono: LucideIcon;
  texto: string;
  /** `mailto:` / `tel:` cuando corresponde; sin esto se muestra como texto. */
  href?: string;
}

/**
 * Datos de contacto de la Secretaría.
 *
 * ⚠️ **Vacío a propósito.** La sección se llamaba "Contacto Institucional" y no
 * traía ningún contacto: sólo el nombre del organismo, que es identidad y no
 * contacto. Un delegado con un problema no tenía a dónde escribir.
 *
 * No se completó con valores inventados porque es información de contacto de un
 * organismo público: publicar un mail o un teléfono equivocado manda a la gente
 * a la nada y es peor que no mostrar nada. Al estar vacío, **la lista no
 * renderiza ningún ítem** y la columna queda con la identidad institucional
 * solamente, que es lo que hay confirmado.
 *
 * Para completarla alcanza con agregar acá los ítems reales —importando de
 * `lucide-react` los iconos que se usen, por ejemplo `Mail`, `Phone` y
 * `MapPin`— con la forma:
 *
 *     { Icono: Mail, texto: 'x@formosa.gob.ar', href: 'mailto:x@formosa.gob.ar' }
 *
 * El resto del componente no cambia.
 */
const CONTACTO: DatoDeContacto[] = [];

/**
 * Enlaces legales del pie.
 *
 * ⚠️ **Vacío a propósito, y es lo más importante que le falta a este footer.**
 * La plataforma recolecta DNI, fecha de nacimiento, domicilio y teléfono **de
 * menores de edad**, lo que en Argentina cae bajo la Ley 25.326 de Protección de
 * Datos Personales. Hoy no hay ninguna página que explique quién trata esos
 * datos, con qué finalidad, ni cómo se ejercen los derechos de acceso y
 * rectificación.
 *
 * No se dejaron los links apuntando a rutas inexistentes: un enlace a una
 * pantalla que no existe es peor que su ausencia. Cuando las páginas estén
 * creadas, se agregan acá y la barra inferior las muestra sola.
 */
const LEGALES: Array<{ label: string; to: string }> = [
  // { label: 'Política de Privacidad', to: ROUTES.PRIVACY },
  // { label: 'Términos de Uso', to: ROUTES.TERMS },
];

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t-2 border-accent-500/30 bg-primary-800 text-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-12">
          {/* Marca */}
          <div className="space-y-3 lg:col-span-4">
            <div className="flex items-center gap-3">
              <img
                src="/logo-sinfondo.png"
                alt=""
                aria-hidden="true"
                className="h-12 w-auto object-contain drop-shadow-sm"
              />
              <div>
                <p className="text-base leading-tight font-extrabold tracking-tight text-white">
                  Juegos Evita Formoseños
                </p>
                <span className="block text-[10px] leading-tight font-bold tracking-widest text-accent-400 uppercase">
                  Secretaría de Deportes
                </span>
              </div>
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-celeste-200">
              Plataforma integral de gestión deportiva. Gobierno de la Provincia
              de Formosa.
            </p>
          </div>

          {/* Navegación */}
          <nav aria-label="Navegación del pie de página" className="lg:col-span-3">
            <h2 className="mb-3 text-sm font-bold tracking-wider text-accent-500 uppercase">
              Navegación
            </h2>
            <ul className="space-y-2 text-sm">
              {ENLACES.map(({ label, to, destacado }) => (
                <li key={to}>
                  <Link
                    to={to}
                    className={
                      destacado
                        ? 'font-semibold text-accent-400 transition-colors hover:text-accent-300'
                        : 'text-celeste-100 transition-colors hover:text-white'
                    }
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Contacto institucional */}
          <div className="lg:col-span-3">
            <h2 className="mb-3 text-sm font-bold tracking-wider text-accent-500 uppercase">
              Contacto institucional
            </h2>
            <p className="text-sm font-medium text-celeste-100">
              Secretaría de Deportes
            </p>
            <p className="text-sm text-celeste-200">
              Gobierno de la Provincia de Formosa
            </p>
            <p className="mt-1 text-xs text-celeste-300">República Argentina</p>

            {CONTACTO.length > 0 && (
              <ul className="mt-4 space-y-2 text-sm">
                {CONTACTO.map(({ Icono, texto, href }) => (
                  <li key={texto} className="flex items-start gap-2">
                    <Icono
                      className="mt-0.5 h-4 w-4 shrink-0 text-accent-500"
                      aria-hidden="true"
                    />
                    {href ? (
                      <a
                        href={href}
                        className="text-celeste-100 transition-colors hover:text-white"
                      >
                        {texto}
                      </a>
                    ) : (
                      <span className="text-celeste-200">{texto}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Acceso del personal — separado de la navegación pública a propósito:
              no es un enlace para el ciudadano, es la puerta del back-office. */}
          <div className="lg:col-span-2">
            <h2 className="mb-3 text-sm font-bold tracking-wider text-accent-500 uppercase">
              Acceso
            </h2>
            <Link
              to={ROUTES.LOGIN}
              className="group inline-flex items-center gap-1.5 rounded-lg border border-primary-700 bg-primary-900/60 px-3 py-2 text-xs font-semibold text-celeste-100 shadow-xs transition-all hover:bg-primary-900 hover:text-white"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-accent-500 group-hover:text-accent-400" />
              <span>Portal Administrativo</span>
            </Link>
            <p className="mt-2 text-xs text-celeste-300">
              Uso exclusivo del personal autorizado.
            </p>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center gap-3 border-t border-primary-700/80 pt-6 sm:flex-row sm:justify-between">
          <p className="text-center text-xs text-celeste-300 sm:text-left">
            © {currentYear} Juegos Evita Formoseños — Secretaría de Deportes de
            Formosa. Todos los derechos reservados.
          </p>

          {LEGALES.length > 0 && (
            <nav aria-label="Enlaces legales">
              <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2">
                {LEGALES.map(({ label, to }) => (
                  <li key={to}>
                    <Link
                      to={to}
                      className="text-xs text-celeste-300 transition-colors hover:text-white"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </div>
      </div>
    </footer>
  );
}
