// ===========================================
// Participants Admin Page
// ===========================================
import { useState } from 'react';
import { Users, Plus, Pencil, MoreVertical, Search } from 'lucide-react';
import { useParticipants } from '@/hooks/useParticipants';
import type { Participant } from '@/types';
import { ParticipantForm } from './components/ParticipantForm';
import { SEX_LABELS, DEFAULT_PAGE_SIZE } from '@/lib/constants';
import { PageHeader } from '@/components/shared/PageHeader';
import { Pagination } from '@/components/shared/Pagination';
import { SkeletonTable } from '@/components/shared/SkeletonTable';
import { EmptyState } from '@/components/shared/EmptyState';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { Link } from 'react-router';

export function ParticipantsPage() {
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [locality, setLocality] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState<Participant | undefined>();

  const { data: participantsData, isLoading } = useParticipants({
    search: search || undefined,
    department: department || undefined,
    locality: locality || undefined,
    page,
    limit,
  });

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

  return (
    <div className="space-y-6">
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

      <div className="card">
        <div className="p-4 border-b border-primary-100 flex flex-wrap gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-400" />
            <Input
              placeholder="Buscar por DNI o Apellido..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-9"
            />
          </div>
          <Input
            placeholder="Departamento..."
            value={department}
            onChange={(e) => { setDepartment(e.target.value); setPage(1); }}
            className="w-full sm:w-[200px]"
          />
          <Input
            placeholder="Localidad..."
            value={locality}
            onChange={(e) => { setLocality(e.target.value); setPage(1); }}
            className="w-full sm:w-[200px]"
          />
        </div>

        <div className="relative">
          {isLoading ? (
            <SkeletonTable rows={limit > 5 ? 8 : 5} columns={5} />
          ) : !participantsData?.data.length ? (
            <EmptyState
              icon={<Users className="w-10 h-10" />}
              title="Sin participantes"
              description="No se encontraron participantes con los filtros aplicados."
              action={
                <Button onClick={handleCreate} className="gap-2">
                  <Plus className="w-4 h-4" /> Crear Participante
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>DNI</TableHead>
                  <TableHead>Apellido y Nombre</TableHead>
                  <TableHead>Sexo / F. Nacimiento</TableHead>
                  <TableHead>Ubicación</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {participantsData.data.map((participant) => (
                  <TableRow key={participant.id}>
                    <TableCell className="font-medium text-primary-600">
                      <Link to={`/admin/participantes/${participant.id}`} className="hover:underline">
                        {participant.dni}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold text-primary-900">{participant.lastName}</span>, {participant.firstName}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col text-sm">
                        <span>{SEX_LABELS[participant.sex]}</span>
                        <span className="text-primary-500">
                          {new Date(participant.birthDate).toLocaleDateString()}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col text-sm">
                        <span>{participant.department}</span>
                        <span className="text-primary-500">{participant.locality}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
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
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Pagination */}
        {participantsData && participantsData.meta.totalPages > 1 && (
          <Pagination
            page={participantsData.meta.page}
            totalPages={participantsData.meta.totalPages}
            total={participantsData.meta.total}
            limit={limit}
            onPageChange={setPage}
            onLimitChange={(newLimit) => { setLimit(newLimit); setPage(1); }}
          />
        )}
      </div>

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
