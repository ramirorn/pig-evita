// ===========================================
// Footer Component
// ===========================================
import { Link } from 'react-router';
import { ShieldCheck } from 'lucide-react';
import { ROUTES } from '@/lib/constants';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-primary-800 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div>
            <h3 className="text-lg font-bold mb-2">Juegos Evita Formosa</h3>
            <p className="text-primary-200 text-sm leading-relaxed">
              Plataforma integral de gestión deportiva.
              Secretaría de Deportes de la Provincia de Formosa.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-primary-300 mb-3">
              Enlaces
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to={ROUTES.DISCIPLINES} className="text-primary-200 hover:text-white transition-colors">
                  Disciplinas
                </Link>
              </li>
              <li>
                <Link to={ROUTES.NEWS} className="text-primary-200 hover:text-white transition-colors">
                  Noticias
                </Link>
              </li>
              <li>
                <Link to={ROUTES.CALENDAR} className="text-primary-200 hover:text-white transition-colors">
                  Calendario
                </Link>
              </li>
              <li>
                <Link to={ROUTES.VENUES} className="text-primary-200 hover:text-white transition-colors">
                  Sedes
                </Link>
              </li>
              <li>
                <Link to={ROUTES.RANKINGS} className="text-primary-200 hover:text-white transition-colors">
                  Rankings
                </Link>
              </li>
              <li className="pt-2 border-t border-primary-700/60">
                <Link
                  to={ROUTES.DASHBOARD}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-primary-200 hover:text-white hover:underline transition-colors"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-secondary-400" />
                  <span>Portal Administrativo</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-primary-300 mb-3">
              Contacto
            </h4>
            <p className="text-primary-200 text-sm">Secretaría de Deportes</p>
            <p className="text-primary-200 text-sm">Provincia de Formosa</p>
            <p className="text-primary-200 text-sm">República Argentina</p>
          </div>
        </div>

        <div className="border-t border-primary-700 mt-8 pt-6 text-center">
          <p className="text-primary-300 text-xs">
            © {currentYear} Juegos Evita Formosa — Secretaría de Deportes. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
