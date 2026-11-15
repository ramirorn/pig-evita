// ===========================================
// Public Layout
// ===========================================
import { Suspense, useState, useEffect } from 'react';
import { Outlet, Link, ScrollRestoration, useLocation } from 'react-router';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ROUTES } from '@/lib/constants';
import { prefetchProps } from '@/lib/routePrefetch';
import { Footer } from './Footer';
import { PublicPageFallback } from '@/components/shared/PublicPageFallback';

const NAV_LINKS = [
  { label: 'Inicio', path: ROUTES.HOME },
  { label: 'Disciplinas', path: ROUTES.DISCIPLINES },
  { label: 'Noticias', path: ROUTES.NEWS },
  { label: 'Calendario', path: ROUTES.CALENDAR },
  { label: 'Sedes', path: ROUTES.VENUES },
  { label: 'Rankings', path: ROUTES.RANKINGS },
  { label: 'Mapa', path: ROUTES.IMPACT_MAP },
  // Pedido explícito del cliente (S20): la encuesta tiene que verse en la
  // navegación principal, no sólo en el QR que se reparte en las canchas. La
  // edición anterior se difundió como un QR suelto y no llegó al 50 %.
  { label: 'Encuesta', path: ROUTES.SURVEY },
];

export function PublicLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Detect scroll for header style change
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Cada vista nueva arranca arriba; atrás/adelante recupera la posición. */}
      <ScrollRestoration />
      {/* Skip to content */}
      <a href="#main-content" className="skip-to-content">
        Saltar al contenido principal
      </a>

      {/* Header */}
      <header
        className={cn(
          'sticky top-0 z-50 backdrop-blur-md border-b transition-[background-color,border-color,box-shadow] duration-200',
          scrolled
            ? 'bg-white/98 border-primary-200 shadow-md'
            : 'bg-white/95 border-primary-100 shadow-sm',
        )}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link
              to={ROUTES.HOME}
              className="group flex items-center gap-2.5 rounded-lg pointer-coarse:min-h-11"
            >
              <img
                src="/logo-sinfondo.png"
                alt="Juegos Evita Formoseños"
                width={34}
                height={40}
                decoding="async"
                className="h-10 w-auto object-contain transition-transform duration-200 ease-out-soft group-hover:scale-105 group-active:scale-100"
              />
              <div className="hidden sm:block">
                <span className="type-h3 text-base text-primary-800 leading-tight block transition-colors duration-120 group-hover:text-primary-600">
                  Juegos Evita
                </span>
                <span className="type-eyebrow text-accent-800 leading-tight block">
                  Formosa
                </span>
              </div>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden lg:flex items-center gap-1" role="navigation" aria-label="Navegación principal">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  {...prefetchProps(link.path)}
                  className={cn(
                    'px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-120 pointer-coarse:flex pointer-coarse:min-h-11 pointer-coarse:items-center',
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
                className="hidden sm:inline-flex items-center px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-secondary-500 to-secondary-600 rounded-lg hover:from-secondary-600 hover:to-secondary-700 active:from-secondary-700 active:to-secondary-700 shadow-sm hover:shadow transition-[background-color,box-shadow] duration-120 pointer-coarse:min-h-11"
              >
                Inscripciones
              </Link>

              {/* Mobile menu button */}
              <button
                type="button"
                className="lg:hidden p-2 rounded-lg text-primary-600 hover:bg-primary-50 active:bg-primary-100 transition-colors duration-120 flex h-11 w-11 items-center justify-center"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-expanded={mobileMenuOpen}
                aria-label="Menú de navegación"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu with slide animation */}
        <div
          className={cn(
            'lg:hidden border-t border-primary-100 bg-white overflow-hidden transition-[max-height,opacity] duration-320 ease-out-soft',
            mobileMenuOpen ? 'max-h-[560px] opacity-100' : 'max-h-0 opacity-0',
          )}
          // Plegado, los links no deben ser alcanzables con Tab.
          inert={!mobileMenuOpen}
        >
          <nav className="px-4 py-3 space-y-1" role="navigation" aria-label="Navegación móvil">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={cn(
                  'block min-h-11 px-3 py-3 text-sm font-medium rounded-lg transition-colors duration-120',
                  location.pathname === link.path
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-primary-600 hover:bg-primary-50 active:bg-primary-100',
                )}
              >
                {link.label}
              </Link>
            ))}
            <Link
              to={ROUTES.INSCRIPTION}
              className="block min-h-11 px-3 py-3 text-sm font-semibold text-secondary-700 bg-secondary-50 hover:bg-secondary-100 active:bg-secondary-200 rounded-lg mt-2 transition-colors duration-120"
            >
              Inscripciones
            </Link>
          </nav>
        </div>
      </header>

      {/* Main content */}
      {/* Las páginas públicas se cargan bajo demanda (R28): el layout —header,
          nav y footer— se pinta de una y sólo el contenido espera su chunk. */}
      <main id="main-content" className="flex-1">
        <Suspense fallback={<PublicPageFallback />}>
          <Outlet />
        </Suspense>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
