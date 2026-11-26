// ===========================================
// newsColumns — columnas de la tabla de noticias
// ===========================================
import { formatDate } from '@/lib/utils';
import { Pencil, Trash2, MoreVertical, Calendar, ExternalLink } from 'lucide-react';
import type { News } from '@/types';
import type { DataTableColumn } from '@/components/shared/DataTable';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

interface NewsColumnActions {
  onEdit: (item: News) => void;
  onDelete: (item: News) => void;
}

/**
 * Cómo se ve cada fila. Vive fuera de la página (mismo layout que equipos y
 * sedes): la página sólo dice qué hacer al editar o eliminar.
 */
export function createNewsColumns({ onEdit, onDelete }: NewsColumnActions): DataTableColumn<News>[] {
  const columnas: DataTableColumn<News>[] = [
    {
      id: 'news',
      header: 'Noticia',
      mobile: 'primary',
      rowHeader: true,
      headClassName: 'min-w-[280px]',
      cell: (item) => (
        <div className="max-w-md">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-primary-900 line-clamp-1">{item.title}</p>
            {item.isExternal && (
              <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-celeste-50 text-celeste-900 border border-celeste-200">
                <ExternalLink className="w-3 h-3" aria-hidden="true" />
                Portal
              </span>
            )}
          </div>
          {item.excerpt && (
            <p className="text-xs text-primary-500 line-clamp-2 mt-0.5">{item.excerpt}</p>
          )}
        </div>
      ),
    },
    {
      id: 'published-at',
      header: 'Fecha de Publicación',
      mobile: 'secondary',
      className: 'text-primary-600',
      cell: (item) => (
        <div className="flex items-center gap-1.5 text-xs">
          {/* `primary-400` sirve como ícono decorativo (3.75:1 ≥ 3), nunca como texto. */}
          <Calendar className="w-3.5 h-3.5 text-primary-400" aria-hidden="true" />
          <span className="tabular-nums">
            {item.publishedAt
              ? formatDate(item.publishedAt)
              : 'No publicada'}
          </span>
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Estado',
      mobile: 'secondary',
      cell: (item) =>
        item.isPublished ? (
          // `green-*` y `amber-*` están fuera de la paleta institucional;
          // además el ámbar 600 sobre ámbar 50 no llegaba a AA.
          <Badge
            variant="outline"
            className="bg-secondary-50 text-secondary-700 border-secondary-200"
          >
            Publicado
          </Badge>
        ) : (
          <Badge variant="outline" className="bg-accent-50 text-accent-800 border-accent-300">
            Borrador
          </Badge>
        ),
    },
    {
      id: 'actions',
      header: 'Acciones',
      mobile: 'actions',
      hideHeader: true,
      interactive: true,
      headClassName: 'w-[80px]',
      cell: (item) =>
        // S19 — una noticia del portal no se edita ni se elimina, y el backend
        // lo rechaza con 403. Peor todavía sería el borrado: la fila se iría y
        // la próxima corrida del sync la volvería a crear. En vez de pintar dos
        // botones que mienten, se explica de dónde viene la noticia.
        item.isExternal ? (
          <a
            href={item.sourceUrl ?? '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-700 hover:text-primary-900 active:text-primary-950 underline underline-offset-2 pointer-coarse:min-h-11 transition-colors duration-120"
            title="Se administra en el portal oficial: acá es un reflejo"
          >
            Ver en el portal
            <ExternalLink className="w-3 h-3" aria-hidden="true" />
          </a>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={`Más acciones para ${item.title}`}>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(item)}>
                <Pencil className="mr-2 h-4 w-4" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete(item)}
                className="text-destructive-600 focus:text-destructive-700 focus:bg-destructive-50"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
    },
  ];

  return columnas;
}
