// ===========================================
// Admin Header Component
// ===========================================
import { LogOut } from 'lucide-react';
import { useAuth } from '@/store/auth.store';
import { ROLE_LABELS } from '@/lib/constants';
import { getInitials } from '@/lib/utils';

export function AdminHeader() {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <header className="sticky top-0 z-30 h-16 bg-white/95 backdrop-blur-md border-b border-primary-100 flex items-center justify-between px-6">
      {/* Breadcrumb area */}
      <div>
        <h1 className="text-lg font-semibold text-primary-800">
          Panel de Administración
        </h1>
      </div>

      {/* User info */}
      <div className="flex items-center gap-4">
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
          className="p-2 rounded-lg text-primary-500 hover:bg-destructive-50 hover:text-destructive-500 transition-colors"
          title="Cerrar sesión"
          aria-label="Cerrar sesión"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
