// ===========================================
// Survey Admin Page — listado de campañas de la encuesta (S20)
// ===========================================
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  HeartPulse,
  Search,
  Plus,
  Pencil,
  Trash2,
  MoreVertical,
  MessageSquareText,
  Users,
  X,
} from 'lucide-react';
import {
  useSurveyCampaigns,
  useDeleteSurveyCampaign,
} from '@/hooks/useSurvey';
import { usePermisos } from '@/hooks/usePermisos';
import { useDebounce } from '@/hooks/useDebounce';
import {
  DEFAULT_PAGE_SIZE,
  ROUTES,
  STAGE_LABELS,
  SURVEY_WINDOW_LABELS,
} from '@/lib/constants';
import { logError } from '@/lib/logger';
import {
  CompetitionStage,
  SurveyCampaignStatus,
  SurveyWindow,
  type SurveyCampaign,
} from '@/types';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';
import { SurveyCampaignForm } from './survey/SurveyCampaignForm';
import { SurveyCampaignStatusBadge } from './survey/SurveyCampaignStatusBadge';
import { puedeEliminarCampania, respuestasDe } from './survey/surveyRules';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/** Valor del filtro "sin filtrar". Radix Select no admite `''` como valor. */
const TODOS = 'todos';

/** Ruta al editor de una campaña concreta. */
function rutaCampania(id: string): string {
  return ROUTES.SURVEY_CAMPAIGN_DETAIL.replace(':id', id);
}

export function SurveyAdminPage() {
  const navigate = useNavigate();
  const { puede } = usePermisos();

  const [search, setSearch] = useState('');
  const [anio, setAnio] = useState('');
  const [status, setStatus] = useState<string>(TODOS);
  const [ventana, setVentana] = useState<string>(TODOS);
  const [etapa, setEtapa] = useState<string>(TODOS);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editando, setEditando] = useState<SurveyCampaign | undefined>();
  const [eliminando, setEliminando] = useState<SurveyCampaign | null>(null);

  // Mismo criterio que Noticias: la búsqueda la resuelve el backend sobre el
  // título, no un filtrado en memoria de la página que está a la vista.
  const debouncedSearch = useDebounce(search);
  const anioNumero = /^\d{4}$/.test(anio.trim()) ? Number(anio.trim()) : undefined;

  const { data, isLoading, isFetching, isError, refetch } = useSurveyCampaigns({
    search: debouncedSearch.trim() || undefined,
    anio: anioNumero,
    status: status === TODOS ? undefined : (status as SurveyCampaignStatus),
    ventana: ventana === TODOS ? undefined : (ventana as SurveyWindow),
    etapa: etapa === TODOS ? undefined : (etapa as CompetitionStage),
    page,
    limit,
  });

  const deleteMutation = useDeleteSurveyCampaign();

  /** Tocar cualquier filtro vuelve a la página 1: el resultado es otro. */
  const alFiltrar = (aplicar: () => void) => {
    aplicar();
    setPage(1);
  };

  const limpiarFiltros = () => {
    setSearch('');
    setAnio('');
    setStatus(TODOS);
    setVentana(TODOS);
    setEtapa(TODOS);
    setPage(1);
  };

  const hayFiltros =
    search.trim().length > 0 ||
    anio.trim().length > 0 ||
    status !== TODOS ||
    ventana !== TODOS ||
    etapa !== TODOS;

  const abrirAlta = () => {
    setEditando(undefined);
    setIsModalOpen(true);
  };

  const cerrarModal = () => {
    setIsModalOpen(false);
    setEditando(undefined);
  };

  const confirmarBorrado = async () => {
    if (!eliminando) return;
    try {
      await deleteMutation.mutateAsync(eliminando.id);
      setEliminando(null);
    } catch (error) {
      logError('SurveyAdminPage.confirmarBorrado', error);
    }
  };

  const columns: DataTableColumn<SurveyCampaign>[] = [
    {
      id: 'campania',
      header: 'Encuesta',
      rowHeader: true,
      headClassName: 'min-w-[260px]',
      cell: (item) => (
        <div className="max-w-md">
          <p className="line-clamp-1 font-semibold text-primary-900">{item.titulo}</p>
          <p className="mt-0.5 text-xs text-primary-500">
            {SURVEY_WINDOW_LABELS[item.ventana]}
            {/* El dato ausente se omite, no se rellena: sin etapa fija, la
                campaña sirve para todas y eso se dice, no se deja en blanco. */}
            {item.etapa ? ` · ${STAGE_LABELS[item.etapa]}` : ' · Todas las etapas'}
          </p>
        </div>
      ),
    },
    {
      id: 'anio',
      header: 'Año',
      className: 'text-primary-700 tabular-nums',
      cell: (item) => item.anio,
    },
    {
      id: 'status',
      header: 'Estado',
      cell: (item) => <SurveyCampaignStatusBadge status={item.status} />,
    },
    {
      id: 'preguntas',
      header: 'Preguntas',
      cell: (item) => (
        <span className="inline-flex items-center gap-1.5 text-xs text-primary-700">
          <MessageSquareText className="h-3.5 w-3.5 text-primary-400" aria-hidden="true" />
          {item._count?.questions ?? 0}
        </span>
      ),
    },
    {
      id: 'respuestas',
      header: 'Respuestas',
      cell: (item) => (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-800 tabular-nums">
          <Users className="h-3.5 w-3.5 text-primary-400" aria-hidden="true" />
          {respuestasDe(item).toLocaleString('es-AR')}
        </span>
      ),
    },
    {
      id: 'actions',
      header: 'Acciones',
      hideHeader: true,
      interactive: true,
      headClassName: 'w-[80px]',
      cell: (item) => {
        // El borrado es la única acción del listado que el backend puede
        // rechazar: con respuestas cargadas responde 409 porque borrar la
        // campaña las borraría en cascada. Se muestra igual, deshabilitada y
        // con el motivo, en vez de desaparecer sin explicación.
        const borrado = puedeEliminarCampania(item);

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={`Más acciones para ${item.titulo}`}>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate(rutaCampania(item.id))}>
                <MessageSquareText className="mr-2 h-4 w-4" />
                Abrir preguntas y resultados
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setEditando(item);
                  setIsModalOpen(true);
                }}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Editar datos
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!borrado.permitido}
                title={borrado.motivo}
                onClick={() => setEliminando(item)}
                className="text-destructive-600 focus:bg-destructive-50 focus:text-destructive-700"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Encuesta"
        description="Campañas de la encuesta de salud mental, sus preguntas y sus resultados"
        icon={<HeartPulse className="h-5 w-5 text-white" />}
        actions={
          // La ruta y la acción comparten el mismo grupo de roles, pero el
          // botón se decide por permiso igual: si mañana `SURVEY_MANAGE` se
          // acota (como pasó con `NEWS_SYNC`), esto ya está del lado correcto.
          puede('SURVEY_MANAGE') && (
            <Button onClick={abrirAlta} className="gap-2">
              <Plus className="h-4 w-4" />
              Nueva encuesta
            </Button>
          )
        }
      />

      <DataTable
        entityName="encuestas"
        columns={columns}
        rows={data?.data ?? []}
        getRowId={(item) => item.id}
        isLoading={isLoading}
        isFetching={isFetching && !isLoading}
        isError={isError}
        onRetry={() => void refetch()}
        meta={data?.meta}
        onPageChange={setPage}
        onLimitChange={(nuevo) => {
          setLimit(nuevo);
          setPage(1);
        }}
        rowLink={(item) => ({
          to: rutaCampania(item.id),
          label: `Abrir ${item.titulo}`,
        })}
        hasActiveFilters={hayFiltros}
        onClearFilters={limpiarFiltros}
        emptyIcon={<HeartPulse className="h-10 w-10" />}
        emptyTitle="Todavía no hay ninguna encuesta"
        emptyDescription="Creá una campaña, escribí las preguntas y publicala cuando esté lista."
        emptyAction={
          puede('SURVEY_MANAGE') && (
            <Button onClick={abrirAlta} className="gap-2">
              <Plus className="h-4 w-4" /> Nueva encuesta
            </Button>
          )
        }
        toolbar={
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1 md:max-w-xs">
              <Search
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary-400"
                aria-hidden="true"
              />
              <Input
                placeholder="Buscar por nombre..."
                aria-label="Buscar encuestas por nombre"
                value={search}
                onChange={(e) => alFiltrar(() => setSearch(e.target.value))}
                className="pl-9"
              />
            </div>

            <Input
              type="number"
              inputMode="numeric"
              placeholder="Año"
              aria-label="Filtrar por año"
              value={anio}
              onChange={(e) => alFiltrar(() => setAnio(e.target.value))}
              className="w-[110px]"
            />

            <Select value={status} onValueChange={(v) => alFiltrar(() => setStatus(v))}>
              <SelectTrigger className="w-[170px]" aria-label="Filtrar por estado">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todos los estados</SelectItem>
                <SelectItem value={SurveyCampaignStatus.BORRADOR}>Borrador</SelectItem>
                <SelectItem value={SurveyCampaignStatus.ACTIVA}>Recibiendo respuestas</SelectItem>
                <SelectItem value={SurveyCampaignStatus.CERRADA}>Cerrada</SelectItem>
              </SelectContent>
            </Select>

            <Select value={ventana} onValueChange={(v) => alFiltrar(() => setVentana(v))}>
              <SelectTrigger className="w-[190px]" aria-label="Filtrar por momento">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>En cualquier momento</SelectItem>
                {Object.values(SurveyWindow).map((v) => (
                  <SelectItem key={v} value={v}>
                    {SURVEY_WINDOW_LABELS[v]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={etapa} onValueChange={(v) => alFiltrar(() => setEtapa(v))}>
              <SelectTrigger className="w-[170px]" aria-label="Filtrar por etapa">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todas las etapas</SelectItem>
                {Object.values(CompetitionStage).map((v) => (
                  <SelectItem key={v} value={v}>
                    {STAGE_LABELS[v]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {hayFiltros && (
              <Button variant="ghost" size="sm" onClick={limpiarFiltros} className="gap-1.5">
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                Limpiar
              </Button>
            )}
          </div>
        }
      />

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>
              {editando ? 'Editar los datos de la encuesta' : 'Nueva encuesta'}
            </DialogTitle>
            <DialogDescription>
              {editando
                ? 'Las preguntas se editan desde la pantalla de la encuesta.'
                : 'Primero los datos generales. Enseguida vas a poder escribir las preguntas.'}
            </DialogDescription>
          </DialogHeader>
          <SurveyCampaignForm
            initialData={editando}
            onCancel={cerrarModal}
            onSuccess={(campania) => {
              cerrarModal();
              // Una campaña nueva nace vacía: llevarla al editor es continuar
              // la tarea que Laura vino a hacer, no una navegación de más.
              if (!editando) navigate(rutaCampania(campania.id));
            }}
          />
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        isOpen={!!eliminando}
        title="¿Eliminar la encuesta?"
        description={`Se va a eliminar "${eliminando?.titulo}" con todas sus preguntas. Esta acción no se puede deshacer.`}
        isLoading={deleteMutation.isPending}
        onConfirm={confirmarBorrado}
        onCancel={() => setEliminando(null)}
      />

      <p className="text-xs text-primary-500">
        ¿Querés ver cómo la ven los chicos?{' '}
        <Link
          to={ROUTES.SURVEY}
          className="font-semibold text-primary-600 underline underline-offset-2 hover:text-primary-800"
        >
          Abrí la página pública de la encuesta
        </Link>
        .
      </p>
    </div>
  );
}
