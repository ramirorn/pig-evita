// ===========================================
// Participants Admin Page
// ===========================================
import { useState } from 'react';
import { Users, Plus, Pencil, MoreVertical, Search } from 'lucide-react';
import { useParticipants } from '@/hooks/useParticipants';
import { useDisciplines } from '@/hooks/useDisciplines';
import { useCategories } from '@/hooks/useCategories';
import type { Participant } from '@/types';
import { ParticipantForm } from './components/ParticipantForm';
import { SEX_LABELS, DEFAULT_PAGE_SIZE } from '@/lib/constants';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function ParticipantsPage() {
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [locality, setLocality] = useState('');
  const [disciplineId, setDisciplineId] = useState<string>('all');
  const [categoryId, setCategoryId] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState<Participant | undefined>();

  const { data: disciplines } = useDisciplines();
  const { data: categories } = useCategories({
    disciplineId: disciplineId !== 'all' ? disciplineId : undefined,
  });

  const { data: participantsData, isLoading, isFetching, isError, refetch } = useParticipants({
    search: search || undefined,
    department: department || undefined,
    locality: locality || undefined,
    disciplineId: disciplineId !== 'all' ? disciplineId : undefined,
    categoryId: categoryId !== 'all' ? categoryId : undefined,
    page,
    limit,
  });

  // El backend resuelve el filtrado, así que "hay filtros activos" es lo único
  // que el DataTable necesita para distinguir el vacío-por-filtro (el usuario
  // buscó mal) del vacío-sin-datos (el padrón está vacío de verdad).
  const hasActiveFilters =
    search.trim() !== '' ||
    department.trim() !== '' ||
    locality.trim() !== '' ||
    disciplineId !== 'all' ||
    categoryId !== 'all';

  const clearFilters = () => {
    setSearch('');
    setDepartment('');
    setLocality('');
    setDisciplineId('all');
    setCategoryId('all');
    setPage(1);
  };

  const handleCreate = () => {
    setEditingParticipant(undefined);
    setIsModalOpen(true);
  };

  const handleEdit = (participant: Participant) => {
    setEditingParticipant(participant);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingParticipant(undefined);
  };

  const columns: DataTableColumn<Participant>[] = [
    {
      id: 'dni',
      header: 'DNI',
      // Columna de identidad: va como `<th scope="row">` y ancla el link
      // primario que cubre la fila entera.
      rowHeader: true,
      className: 'font-mono',
      headClassName: 'min-w-[120px]',
      cell: (participant) => participant.dni,
    },
    {
      id: 'name',
      header: 'Apellido y Nombre',
      headClassName: 'min-w-[200px]',
      cell: (participant) => (
        <>
          <span className="font-semibold text-primary-900">{participant.lastName}</span>,{' '}
          {participant.firstName}
        </>
      ),
    },
    {
      id: 'sex-birth',
      header: 'Sexo / F. Nacimiento',
      cell: (participant) => (
        <div className="flex flex-col text-sm">
          <span>{SEX_LABELS[participant.sex]}</span>
          <span className="text-primary-500">
            {new Date(participant.birthDate).toLocaleDateString()}
          </span>
        </div>
      ),
    },
    {
      id: 'location',
      header: 'Ubicación',
      cell: (participant) => (
        <div className="flex flex-col text-sm">
          <span>{participant.department}</span>
          <span className="text-primary-500">{participant.locality}</span>
        </div>
      ),
    },
    {
      id: 'actions',
      header: 'Acciones',
      hideHeader: true,
      // Celda con controles propios: se eleva sobre el overlay del link primario.
      interactive: true,
      headClassName: 'w-[80px]',
      cell: (participant) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              // Antes era un botón sin nombre accesible: el lector anunciaba
              // "botón" a secas, una vez por fila.
              aria-label={`Más acciones para ${participant.lastName}, ${participant.firstName}`}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleEdit(participant)}>
              <Pencil className="mr-2 h-4 w-4" />
              Editar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

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
          <>
            <div className="relative flex-1 min-w-[200px]">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-400"
                aria-hidden="true"
              />
              <Input
                placeholder="Buscar por DNI o Apellido..."
                aria-label="Buscar participantes"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9"
              />
            </div>

            <Select
              value={disciplineId}
              onValueChange={(v) => {
                setDisciplineId(v);
                setCategoryId('all');
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full md:w-[200px]" aria-label="Filtrar por disciplina">
                <SelectValue placeholder="Disciplina" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las disciplinas</SelectItem>
                {disciplines?.data.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={categoryId}
              onValueChange={(v) => {
                setCategoryId(v);
                setPage(1);
              }}
              disabled={disciplineId === 'all'}
            >
              <SelectTrigger className="w-full md:w-[200px]" aria-label="Filtrar por categoría">
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                {categories?.data.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              placeholder="Departamento..."
              aria-label="Filtrar por departamento"
              value={department}
              onChange={(e) => {
                setDepartment(e.target.value);
                setPage(1);
              }}
              className="w-full md:w-[180px]"
            />

            <Input
              placeholder="Localidad..."
              aria-label="Filtrar por localidad"
              value={locality}
              onChange={(e) => {
                setLocality(e.target.value);
                setPage(1);
              }}
              className="w-full md:w-[180px]"
            />
          </>
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
