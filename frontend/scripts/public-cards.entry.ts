// Punto de entrada del chequeo de las tarjetas públicas
// (scripts/check-public-cards.mjs).
//
// Sólo reexporta el código REAL: toda la lógica de aserción vive en el .mjs.
// Un espejo de la lógica acá adentro haría que el chequeo se verifique a sí
// mismo, que es exactamente lo que no sirve.
export { DisciplineCard } from '@/pages/public/disciplines/DisciplineCard';
export { VenueCard } from '@/pages/public/venues/VenueCard';
export { CompetitionCard } from '@/pages/public/rankings/CompetitionCard';
export { CalendarAgenda } from '@/pages/public/calendar/CalendarAgenda';
export { agruparPorMes, rangoDeDias, ocurreHoy } from '@/pages/public/calendar/agendaPorMes';
export { columnasSegunVolumen, retrasoDeEntrada } from '@/lib/gridVolumen';
export { PublicListState } from '@/components/shared/PublicListState';
export { CardGridSkeleton } from '@/components/shared/CardGridSkeleton';
export { NewsCard } from '@/pages/public/news/NewsCard';
export { FeaturedNewsCard } from '@/pages/public/news/FeaturedNewsCard';
export { NewsMosaicCard } from '@/pages/public/news/NewsMosaicCard';
export { NewsSidebarList } from '@/pages/public/news/NewsSidebarList';
export {
  antiguedadDeNoticia,
  fechaDeNoticia,
  fechaDePublicacion,
} from '@/pages/public/news/newsSource';
export { formatDate } from '@/lib/utils';
