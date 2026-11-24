// ===========================================
// Admin Header Component
// ===========================================
import { Link } from 'react-router';
import { LogOut, Globe, Menu } from 'lucide-react';
import { useAuth } from '@/store/auth.store';
import { ROLE_LABELS, ROUTES } from '@/lib/constants';
import { getInitials } from '@/lib/utils';

interface AdminHeaderProps {
  onMenuClick?: () => void;
}

export function AdminHeader({ onMenuClick }: AdminHeaderProps) {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <header className="sticky top-0 z-30 h-16 bg-white/95 backdrop-blur-md border-b border-primary-100 flex items-center justify-between px-4 sm:px-6">
      {/* Left side */}
      <div className="flex items-center gap-3">
        {/* Mobile hamburger */}
        <button
          onClick={onMenuClick}
          className="md:hidden p-2 -ml-2 rounded-lg text-primary-600 hover:bg-primary-50 active:bg-primary-100 transition-colors duration-120 pointer-coarse:flex pointer-coarse:h-11 pointer-coarse:w-11 pointer-coarse:items-center pointer-coarse:justify-center"
          aria-label="Abrir menú"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* F-36b: no es un <h1>. El título de cada pantalla ya lo es, y dos
            <h1> por vista dejaban al lector de pantalla sin saber cuál manda.
            Por eso acá sólo hay una marca compacta de una línea, sin competir
            con el título de la página. */}
        <p className="truncate text-sm font-semibold text-primary-800">
          Juegos Evita
          <span className="font-normal text-primary-600"> · Panel</span>
        </p>
      </div>

      {/* User info & Actions */}
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Link to Public Website */}
        <Link
          to={ROUTES.HOME}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-600 hover:text-primary-800 bg-primary-50/70 hover:bg-primary-100/70 active:bg-primary-100 border border-primary-200 rounded-lg transition-colors duration-120 pointer-coarse:min-h-11 pointer-coarse:min-w-11 pointer-coarse:justify-center"
          title="Ver portal público de Juegos Evita"
        >
          <Globe className="w-3.5 h-3.5 text-primary-500" />
          <span className="hidden sm:inline">Ver Sitio Web</span>
        </Link>

        {/* Role badge */}
        <span className="hidden sm:inline-flex badge bg-primary-50 text-primary-700 border-primary-200 text-xs">
          {ROLE_LABELS[user.role]}
        </span>

        {/* Avatar + name */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
            {getInitials(user.firstName, user.lastName)}
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-primary-800 leading-tight">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-xs text-primary-500 leading-tight">{user.email}</p>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={logout}
          className="p-2 rounded-lg text-primary-500 hover:bg-destructive-50 hover:text-destructive-500 transition-colors duration-120 pointer-coarse:flex pointer-coarse:h-11 pointer-coarse:w-11 pointer-coarse:items-center pointer-coarse:justify-center"
          title="Cerrar sesión"
          aria-label="Cerrar sesión"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
