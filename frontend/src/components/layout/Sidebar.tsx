// ===========================================
// Admin Sidebar Component
// ===========================================
import { Link, useLocation } from 'react-router';
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  UserPlus,
  Trophy,
  Tag,
  UsersRound,
  Swords,
  Medal,
  FileText,
  Newspaper,
  CalendarDays,
  MapPin,
  UserCog,
  BarChart3,
  Shield,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ROUTES, ADMIN_ROLES } from '@/lib/constants';
import { useAuth } from '@/store/auth.store';
import { UserRole } from '@/types';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  roles?: UserRole[];
  separator?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', path: ROUTES.DASHBOARD, icon: <LayoutDashboard className="w-5 h-5" /> },
  // Gestión
  { label: 'Participantes', path: ROUTES.PARTICIPANTS, icon: <Users className="w-5 h-5" />, separator: true },
  { label: 'Inscripciones', path: ROUTES.INSCRIPTIONS, icon: <ClipboardList className="w-5 h-5" /> },
  { label: 'Nueva Inscripción', path: ROUTES.NEW_INSCRIPTION, icon: <UserPlus className="w-5 h-5" />, roles: [...ADMIN_ROLES, UserRole.DELEGADO] },
  { label: 'Equipos', path: ROUTES.TEAMS, icon: <UsersRound className="w-5 h-5" /> },
  { label: 'Documentos', path: ROUTES.DOCUMENTS, icon: <FileText className="w-5 h-5" /> },
  // Competencias
  { label: 'Disciplinas', path: ROUTES.DISCIPLINES_ADMIN, icon: <Trophy className="w-5 h-5" />, separator: true, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN_PROVINCIAL] },
  { label: 'Categorías', path: ROUTES.CATEGORIES_ADMIN, icon: <Tag className="w-5 h-5" />, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN_PROVINCIAL] },
  { label: 'Competencias', path: ROUTES.COMPETITIONS, icon: <Swords className="w-5 h-5" />, roles: [...ADMIN_ROLES] },
  { label: 'Resultados', path: ROUTES.RESULTS, icon: <Medal className="w-5 h-5" /> },
  // Contenido
  { label: 'Noticias', path: ROUTES.NEWS_ADMIN, icon: <Newspaper className="w-5 h-5" />, separator: true, roles: [...ADMIN_ROLES] },
  { label: 'Calendario', path: ROUTES.CALENDAR_ADMIN, icon: <CalendarDays className="w-5 h-5" />, roles: [...ADMIN_ROLES] },
  { label: 'Sedes', path: ROUTES.VENUES_ADMIN, icon: <MapPin className="w-5 h-5" />, roles: [...ADMIN_ROLES] },
  // Sistema
  { label: 'Usuarios', path: ROUTES.USERS, icon: <UserCog className="w-5 h-5" />, separator: true, roles: [UserRole.SUPER_ADMIN] },
  { label: 'Reportes', path: ROUTES.REPORTS, icon: <BarChart3 className="w-5 h-5" /> },
  { label: 'Auditoría', path: ROUTES.AUDIT, icon: <Shield className="w-5 h-5" />, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN_PROVINCIAL] },
];

export function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }: SidebarProps) {
  const location = useLocation();
  const { hasRole } = useAuth();

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.roles || hasRole(...item.roles),
  );

  const sidebarContent = (
    <>
      {/* Logo area */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-primary-100">
        <Link to={ROUTES.DASHBOARD} className="flex items-center gap-2.5 overflow-hidden">
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
        {visibleItems.map((item, idx) => {
          const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
          const showCollapsed = collapsed && !mobileOpen;

          return (
            <div key={item.path}>
              {item.separator && idx > 0 && (
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
