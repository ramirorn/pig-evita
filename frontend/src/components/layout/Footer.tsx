// ===========================================
// Footer Component
// ===========================================
import { Link } from 'react-router';
import { ShieldCheck } from 'lucide-react';
import { ROUTES } from '@/lib/constants';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-primary-800 text-white border-t-2 border-accent-500/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <img
                src="/logo-sinfondo.png"
                alt="Juegos Evita Formoseños"
                className="h-12 w-auto object-contain drop-shadow-sm"
              />
              <div>
                <h3 className="text-base font-extrabold tracking-tight text-white leading-tight">
                  Juegos Evita Formoseños
                </h3>
                <span className="text-[10px] text-accent-400 font-bold uppercase tracking-widest block leading-tight">
                  Secretaría de Deportes
                </span>
              </div>
            </div>
            <p className="text-celeste-200 text-sm leading-relaxed max-w-sm">
              Plataforma integral de gestión deportiva.
              Gobierno de la Provincia de Formosa.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider text-accent-500 mb-3">
              Enlaces Rápidos
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to={ROUTES.DISCIPLINES} className="text-celeste-100 hover:text-white transition-colors">
                  Disciplinas
                </Link>
              </li>
              <li>
                <Link to={ROUTES.NEWS} className="text-celeste-100 hover:text-white transition-colors">
                  Noticias
                </Link>
              </li>
              <li>
                <Link to={ROUTES.CALENDAR} className="text-celeste-100 hover:text-white transition-colors">
                  Calendario
                </Link>
              </li>
              <li>
                <Link to={ROUTES.VENUES} className="text-celeste-100 hover:text-white transition-colors">
                  Sedes
                </Link>
              </li>
              <li>
                <Link to={ROUTES.RANKINGS} className="text-celeste-100 hover:text-white transition-colors">
                  Rankings
                </Link>
              </li>
              <li className="pt-2.5 border-t border-primary-700/80">
                <Link
                  to={ROUTES.DASHBOARD}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-celeste-100 hover:text-white bg-primary-900/60 hover:bg-primary-900 px-3 py-1.5 rounded-lg border border-primary-700 transition-all group shadow-xs"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-accent-500 group-hover:text-accent-400" />
                  <span>Portal Administrativo</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider text-accent-500 mb-3">
              Contacto Institucional
            </h4>
            <p className="text-celeste-100 text-sm font-medium">Secretaría de Deportes</p>
            <p className="text-celeste-200 text-sm">Gobierno de la Provincia de Formosa</p>
            <p className="text-celeste-300 text-xs mt-1">República Argentina</p>
          </div>
        </div>

        <div className="border-t border-primary-700/80 mt-8 pt-6 text-center">
          <p className="text-celeste-300 text-xs">
            © {currentYear} Juegos Evita Formoseños — Secretaría de Deportes de Formosa. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
