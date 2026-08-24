// ===========================================
// Admin Sidebar Component
// ===========================================
import { Link, useLocation } from 'react-router';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ROUTES } from '@/lib/constants';
import { rutaInicialPara } from '@/lib/adminRoutes';
import { useAuth } from '@/store/auth.store';
import { navItemsParaRol } from './navItems';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }: SidebarProps) {
  const location = useLocation();
  const { user } = useAuth();

  // Qué links ve cada rol sale del mismo mapa que usa el router para decidir a
  // qué rutas puede entrar (R08). Los separadores ya vienen resueltos sobre la
  // lista completa, así que un grupo no pierde su línea porque se filtre el
  // primer ítem.
  const visibleItems = navItemsParaRol(user?.role);

  // El logo lleva a la primera pantalla que el rol puede ver, no al dashboard
  // fijo: para un ARBITRO el dashboard es un "Acceso Denegado".
  const inicio = user ? rutaInicialPara(user.role) : ROUTES.HOME;

  const sidebarContent = (
    <>
      {/* Logo area */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-primary-100">
        <Link to={inicio} className="flex items-center gap-2.5 overflow-hidden">
          <img
            src="/logo-sinfondo.png"
            alt="Juegos Evita Formoseños"
            className="w-9 h-9 min-w-[36px] object-contain"
          />
          {(!collapsed || mobileOpen) && (
            <div className="animate-fade-in">
              <span className="text-sm font-bold text-primary-800 block leading-tight">
                Juegos Evita
              </span>
              <span className="text-[9px] text-accent-600 font-bold uppercase tracking-widest block leading-tight">
                Panel Admin
              </span>
            </div>
          )}
        </Link>

        {/* Close button on mobile */}
        {mobileOpen && (
          <button
            onClick={onMobileClose}
            className="md:hidden p-1.5 rounded-lg text-primary-400 hover:bg-primary-50 transition-colors"
            aria-label="Cerrar menú"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5" aria-label="Navegación administrativa">
        {visibleItems.map((item) => {
          const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
          const showCollapsed = collapsed && !mobileOpen;

          return (
            <div key={item.path}>
              {item.showSeparator && (
                <div className="my-3 border-t border-primary-50" />
              )}
              <Link
                to={item.path}
                title={showCollapsed ? item.label : undefined}
                onClick={onMobileClose}
                className={cn(
                  'relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                  isActive
                    ? 'bg-primary-50 text-primary-700 shadow-sm'
                    : 'text-primary-600 hover:bg-primary-50/60 hover:text-primary-700',
                  showCollapsed && 'justify-center px-2',
                )}
              >
                <span className="flex-shrink-0">{item.icon}</span>
                {!showCollapsed && <span className="truncate">{item.label}</span>}
                {/* Active indicator bar */}
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-primary-600 rounded-r-full" />
                )}
              </Link>
            </div>
          );
        })}
      </nav>

      {/* Collapse toggle (desktop only) */}
      <div className="hidden md:block border-t border-primary-100 p-3">
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm text-primary-500 hover:bg-primary-50 transition-colors"
          aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4" />
              <span>Colapsar</span>
            </>
          )}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden md:flex fixed left-0 top-0 z-40 h-screen flex-col bg-white border-r border-primary-100 transition-all duration-300 ease-in-out',
          collapsed ? 'w-[72px]' : 'w-[260px]',
        )}
      >
        {sidebarContent}
      </aside>

      {/* Mobile sidebar (drawer) */}
      <aside
        className={cn(
          'md:hidden fixed left-0 top-0 z-50 h-screen w-[280px] flex flex-col bg-white border-r border-primary-100 transition-transform duration-300 ease-in-out shadow-2xl',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
