// ===========================================
// Ítems de navegación del panel admin
// ===========================================
import type { ReactNode } from 'react';
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
} from 'lucide-react';
import { ROUTES } from '@/lib/constants';
import { puedeVerRuta, type AdminRoutePath } from '@/lib/adminRoutes';
import type { UserRole } from '@/types';

export interface NavItem {
  label: string;
  /**
   * Tiene que ser una ruta declarada en `ADMIN_ROUTE_ROLES`: el tipo impide
   * agregar al menú un link a una pantalla que el router no conoce, y de ahí
   * salen los roles que lo ven.
   */
  path: AdminRoutePath;
  icon: ReactNode;
  /** Abre un grupo visual: dibuja una línea antes del ítem. */
  separator?: boolean;
}

/**
 * El menú del panel. **No declara roles**: cada ítem hereda los de su ruta desde
 * `ADMIN_ROUTE_ROLES`.
 *
 * Antes cada ítem traía su propia lista (o ninguna, que equivalía a "todos") y
 * divergía del `allowedRoles` del router en las dos direcciones: siete ítems se
 * mostraban a roles que no podían entrar, y "Usuarios" se le escondía a un
 * `ADMIN_PROVINCIAL` que sí podía.
 */
export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', path: ROUTES.DASHBOARD, icon: <LayoutDashboard className="w-5 h-5" /> },
  // Gestión
  { label: 'Participantes', path: ROUTES.PARTICIPANTS, icon: <Users className="w-5 h-5" />, separator: true },
  { label: 'Inscripciones', path: ROUTES.INSCRIPTIONS, icon: <ClipboardList className="w-5 h-5" /> },
  { label: 'Nueva Inscripción', path: ROUTES.NEW_INSCRIPTION, icon: <UserPlus className="w-5 h-5" /> },
  { label: 'Equipos', path: ROUTES.TEAMS, icon: <UsersRound className="w-5 h-5" /> },
  { label: 'Documentos', path: ROUTES.DOCUMENTS, icon: <FileText className="w-5 h-5" /> },
  // Competencias
  { label: 'Disciplinas', path: ROUTES.DISCIPLINES_ADMIN, icon: <Trophy className="w-5 h-5" />, separator: true },
  { label: 'Categorías', path: ROUTES.CATEGORIES_ADMIN, icon: <Tag className="w-5 h-5" /> },
  { label: 'Competencias', path: ROUTES.COMPETITIONS, icon: <Swords className="w-5 h-5" /> },
  { label: 'Resultados', path: ROUTES.RESULTS, icon: <Medal className="w-5 h-5" /> },
  // Contenido
  { label: 'Noticias', path: ROUTES.NEWS_ADMIN, icon: <Newspaper className="w-5 h-5" />, separator: true },
  { label: 'Calendario', path: ROUTES.CALENDAR_ADMIN, icon: <CalendarDays className="w-5 h-5" /> },
  { label: 'Sedes', path: ROUTES.VENUES_ADMIN, icon: <MapPin className="w-5 h-5" /> },
  // Sistema
  { label: 'Usuarios', path: ROUTES.USERS, icon: <UserCog className="w-5 h-5" />, separator: true },
  { label: 'Reportes', path: ROUTES.REPORTS, icon: <BarChart3 className="w-5 h-5" /> },
  { label: 'Auditoría', path: ROUTES.AUDIT, icon: <Shield className="w-5 h-5" /> },
];

export interface VisibleNavItem extends NavItem {
  /** Si hay que dibujar la línea de grupo antes de este ítem. */
  showSeparator: boolean;
}

/**
 * Los ítems que le corresponden a un rol, con los separadores ya resueltos.
 *
 * El flag `separator` marca el **comienzo de un grupo**, y antes se evaluaba
 * sobre la lista ya filtrada: si el ítem que lo portaba se caía por rol, el grupo
 * entero perdía su línea. Acá el separador pendiente se arrastra hasta el primer
 * ítem visible del grupo, y nunca se dibuja arriba de todo.
 */
export function navItemsParaRol(role: UserRole | undefined): VisibleNavItem[] {
  if (!role) return [];

  const visibles: VisibleNavItem[] = [];
  let separadorPendiente = false;

  for (const item of NAV_ITEMS) {
    if (item.separator) separadorPendiente = true;
    if (!puedeVerRuta(role, item.path)) continue;

    visibles.push({ ...item, showSeparator: separadorPendiente && visibles.length > 0 });
    separadorPendiente = false;
  }

  return visibles;
}
