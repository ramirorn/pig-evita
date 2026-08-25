// Punto de entrada del chequeo de sincronización del menú (scripts/check-nav-roles.mjs).
// Sólo reexporta el código real: toda la lógica de aserción vive en el .mjs.
export { NAV_ITEMS, navItemsParaRol } from '@/components/layout/navItems';
export { ADMIN_ROUTE_ROLES, puedeVerRuta, rutaInicialPara, destinoPostLogin } from '@/lib/adminRoutes';
export { QUICK_ACTIONS, quickActionsParaRol } from '@/pages/admin/dashboard/quickActions';
export { ADMIN_AREA_ROLES } from '@/lib/roles';
export { ACTION_ROLES, ACCIONES_POR_PANTALLA, puedeAccion } from '@/lib/adminActions';
export { ROLES_CON_ALCANCE_PROVINCIAL, puedeFiltrarPorDepartamento } from '@/lib/adminScope';
export { ROUTES } from '@/lib/constants';
export { UserRole } from '@/types';
