// ===========================================
// Participants Admin Page
// ===========================================
import { useState } from 'react';
import { Users, Plus } from 'lucide-react';
import { useParticipants } from '@/hooks/useParticipants';
import { useDisciplines } from '@/hooks/useDisciplines';
import { useCategories } from '@/hooks/useCategories';
import { useDebounce } from '@/hooks/useDebounce';
import type { Participant } from '@/types';
import { ParticipantForm } from './components/ParticipantForm';
import { DEFAULT_PAGE_SIZE } from '@/lib/constants';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable } from '@/components/shared/DataTable';
import { createParticipantColumns } from './participants/participantColumns';
import { ParticipantsToolbar } from './participants/ParticipantsToolbar';
import {
  EMPTY_PARTICIPANT_FILTERS,
  hasActiveParticipantFilters,
  toParticipantQuery,
  type ParticipantListFilters,
} from './participants/participantFilters';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export function ParticipantsPage() {
  const [filters, setFilters] = useState<ParticipantListFilters>(EMPTY_PARTICIPANT_FILTERS);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState<Participant | undefined>();

  const { data: disciplines } = useDisciplines();
  const { data: categories } = useCategories({
    disciplineId: filters.disciplineId !== 'all' ? filters.disciplineId : undefined,
  });

  // Los tres filtros de texto se amortiguan antes de entrar a la `queryKey`
  // (R20): los `<input>` siguen atados a `filters` y responden sin retardo,
  // pero la request espera a que el usuario deje de tipear. Los `Select` no
  // pasan por el debounce: un click es una intención completa, no una ráfaga.
  const debouncedSearch = useDebounce(filters.search);
  const debouncedDepartment = useDebounce(filters.department);
  const debouncedLocality = useDebounce(filters.locality);

  const { data: participantsData, isLoading, isFetching, isError, refetch } = useParticipants({
    ...toParticipantQuery({
      ...filters,
      search: debouncedSearch,
      department: debouncedDepartment,
      locality: debouncedLocality,
    }),
    page,
    limit,
  });

  // El backend resuelve el filtrado, así que "hay filtros activos" es lo único
  // que el DataTable necesita para distinguir el vacío-por-filtro (el usuario
  // buscó mal) del vacío-sin-datos (el padrón está vacío de verdad).
  const hasActiveFilters = hasActiveParticipantFilters(filters);

  // Tocar cualquier filtro vuelve a la primera página: el resultado es otro y
  // la página en la que estabas puede ya no existir.
  const patchFilters = (patch: Partial<ParticipantListFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters(EMPTY_PARTICIPANT_FILTERS);
    setPage(1);
  };

  const handleCreate = () => {
    setEditingParticipant(undefined);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingParticipant(undefined);
  };

  const columns = createParticipantColumns({
    onEdit: (participant) => {
      setEditingParticipant(participant);
      setIsModalOpen(true);
    },
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Participantes"
        description="Padrón único de deportistas y entrenadores"
        icon={<Users className="w-5 h-5 text-white" />}
        actions={
          <Button onClick={handleCreate} className="gap-2">
            <Plus className="w-4 h-4" />
            Nuevo Participante
          </Button>
        }
      />

      <DataTable
        entityName="participantes"
        columns={columns}
        rows={participantsData?.data ?? []}
        getRowId={(participant) => participant.id}
        // El texto visible del link es el DNI; el nombre accesible es la
        // persona, para que el lector no anuncie "enlace, 20304050".
        rowLink={(participant) => ({
          to: `/admin/participantes/${participant.id}`,
          label: `${participant.lastName}, ${participant.firstName}`,
        })}
        isLoading={isLoading}
        isFetching={isFetching && !isLoading}
        isError={isError}
        onRetry={() => void refetch()}
        meta={participantsData?.meta}
        onPageChange={setPage}
        onLimitChange={(newLimit) => {
          setLimit(newLimit);
          setPage(1);
        }}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearFilters}
        emptyIcon={<Users className="w-10 h-10" />}
        emptyTitle="Todavía no hay participantes"
        emptyDescription="Registrá al primer deportista o entrenador para empezar a armar el padrón."
        emptyAction={
          <Button onClick={handleCreate} className="gap-2">
            <Plus className="w-4 h-4" /> Crear Participante
          </Button>
        }
        toolbar={
          <ParticipantsToolbar
            filters={filters}
            onChange={patchFilters}
            disciplines={disciplines?.data ?? []}
            categories={categories?.data ?? []}
          />
        }
      />

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingParticipant ? 'Editar Participante' : 'Nuevo Participante'}
            </DialogTitle>
          </DialogHeader>
          <ParticipantForm
            initialData={editingParticipant}
            onSuccess={closeModal}
            onCancel={closeModal}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
