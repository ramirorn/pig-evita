// ===========================================
// Public Layout
// ===========================================
import { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router';
import { Menu, X, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ROUTES } from '@/lib/constants';
import { Footer } from './Footer';

const NAV_LINKS = [
  { label: 'Inicio', path: ROUTES.HOME },
  { label: 'Disciplinas', path: ROUTES.DISCIPLINES },
  { label: 'Noticias', path: ROUTES.NEWS },
  { label: 'Calendario', path: ROUTES.CALENDAR },
  { label: 'Sedes', path: ROUTES.VENUES },
  { label: 'Rankings', path: ROUTES.RANKINGS },
];

export function PublicLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Skip to content */}
      <a href="#main-content" className="skip-to-content">
        Saltar al contenido principal
      </a>

      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-primary-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link
              to={ROUTES.HOME}
              className="flex items-center gap-2.5 group"
            >
              <img
                src="/logo-sinfondo.png"
                alt="Juegos Evita Formoseños"
                className="h-10 w-auto object-contain transition-transform group-hover:scale-105"
              />
              <div className="hidden sm:block">
                <span className="text-base font-bold text-primary-800 leading-tight block">
                  Juegos Evita
                </span>
                <span className="text-[10px] text-accent-600 font-bold uppercase tracking-widest leading-tight block">
                  Formosa
                </span>
              </div>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-1" role="navigation" aria-label="Navegación principal">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={cn(
                    'px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                    location.pathname === link.path
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-primary-600 hover:bg-primary-50 hover:text-primary-700',
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* CTA + Mobile toggle */}
            <div className="flex items-center gap-3">
              <Link
                to={ROUTES.INSCRIPTION}
                className="hidden sm:inline-flex items-center px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-secondary-500 to-secondary-600 rounded-lg hover:from-secondary-600 hover:to-secondary-700 shadow-sm hover:shadow transition-all"
              >
                Inscribirse
              </Link>

              {/* Mobile menu button */}
              <button
                type="button"
                className="md:hidden p-2 rounded-lg text-primary-600 hover:bg-primary-50 transition-colors"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-expanded={mobileMenuOpen}
                aria-label="Menú de navegación"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-primary-100 bg-white animate-fade-in">
            <nav className="px-4 py-3 space-y-1" role="navigation" aria-label="Navegación móvil">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    'block px-3 py-2.5 text-sm font-medium rounded-lg transition-colors',
                    location.pathname === link.path
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-primary-600 hover:bg-primary-50',
                  )}
                >
                  {link.label}
                </Link>
              ))}
              <Link
                to={ROUTES.INSCRIPTION}
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2.5 text-sm font-semibold text-secondary-700 bg-secondary-50 rounded-lg mt-2"
              >
                📝 Inscribirse
              </Link>
            </nav>
          </div>
        )}
      </header>

      {/* Main content */}
      <main id="main-content" className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
