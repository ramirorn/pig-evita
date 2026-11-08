// ===========================================
// Team Detail Page (Member Management)
// ===========================================
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { UsersRound, ArrowLeft, Plus, Trash2, Loader2 } from 'lucide-react';
import { useTeam, useRemoveTeamMember } from '@/hooks/useTeams';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import type { TeamMember } from '@/types';
import { ROUTES } from '@/lib/constants';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import { logError } from '@/lib/logger';
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable';

function AddMemberModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Añadir Jugador</DialogTitle>
          <DialogDescription>
            Busca y selecciona un participante registrado para añadirlo a este equipo.
          </DialogDescription>
        </DialogHeader>
        <div className="py-8 text-center text-primary-500">
          (Formulario de búsqueda de participantes pendiente)
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function TeamDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const { data: team, isLoading } = useTeam(id || '');
  const removeMemberMutation = useRemoveTeamMember();
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<TeamMember | null>(null);

  const handleRemove = async () => {
    if (!team || !memberToRemove) return;
    try {
      await removeMemberMutation.mutateAsync({ teamId: team.id, participantId: memberToRemove.participantId });
      setMemberToRemove(null);
    } catch (e) {
      logError('TeamDetailPage.handleRemove', e);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  if (!team) {
    return (
      <div className="text-center py-12">
        <h2 className="type-h2 text-primary-800">Equipo no encontrado</h2>
        <Button variant="link" onClick={() => navigate(ROUTES.TEAMS)}>Volver a equipos</Button>
      </div>
    );
  }

  const rosterColumns: DataTableColumn<TeamMember>[] = [
    {
      id: 'dni',
      header: 'DNI',
      mobile: 'secondary',
      className: 'text-primary-600 tabular-nums',
      cell: (member) => member.participant?.dni,
    },
    {
      id: 'player',
      header: 'Jugador',
      rowHeader: true,
      mobile: 'primary',
      className: 'font-medium text-primary-900',
      cell: (member) => (
        <>
          {member.participant?.lastName}, {member.participant?.firstName}
        </>
      ),
    },
    {
      id: 'number',
      header: 'Nº',
      mobile: 'secondary',
      className: 'tabular-nums',
      cell: (member) => member.shirtNumber || '-',
    },
    {
      id: 'position',
      header: 'Posición',
      mobile: 'secondary',
      cell: (member) => member.position || '-',
    },
    {
      id: 'role',
      header: 'Rol',
      mobile: 'secondary',
      cell: (member) =>
        member.isCaptain ? (
          <Badge variant="outline" className="bg-accent-50 text-accent-800 border-accent-300">
            Capitán
          </Badge>
        ) : (
          <Badge variant="outline" className="bg-muted text-primary-700 border-primary-200">
            Jugador
          </Badge>
        ),
    },
    {
      id: 'actions',
      header: 'Quitar del equipo',
      hideHeader: true,
      interactive: true,
      mobile: 'actions',
      headClassName: 'w-[80px]',
      cell: (member) => (
        <Button
          variant="ghost"
          size="icon"
          className="text-destructive-600 hover:text-destructive-700 hover:bg-destructive-50 active:bg-destructive-100"
          onClick={() => setMemberToRemove(member)}
          aria-label="Quitar del equipo"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: 'Equipos', path: ROUTES.TEAMS },
          { label: team.name },
        ]}
      />

      <div className="flex flex-wrap items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => navigate(ROUTES.TEAMS)} aria-label="Volver a equipos">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="type-h1 text-primary-800">{team.name}</h1>
          <div className="flex gap-2 text-sm text-primary-500 mt-1">
            <span>{team.department}, {team.locality}</span>
            <span>•</span>
            <span>{team.discipline?.name} - {team.category?.name}</span>
          </div>
        </div>
        <Button onClick={() => setIsAddModalOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Añadir Jugador
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        {/* Team Stats/Info */}
        <div className="md:col-span-1 space-y-4">
          <div className="card p-4 space-y-4">
            <h2 className="type-h3 text-primary-900 border-b border-primary-100 pb-2">Información</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-primary-500">Disciplina</span>
                <span className="font-medium text-primary-900">{team.discipline?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-primary-500">Categoría</span>
                <span className="font-medium text-primary-900">{team.category?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-primary-500">Jugadores</span>
                <span className="font-medium tabular-nums text-primary-900">
                  {team.members?.length || 0} / {team.discipline?.maxPlayers || '-'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Roster Table */}
        <DataTable
          className="md:col-span-3"
          entityName="jugadores"
          columns={rosterColumns}
          rows={team.members ?? []}
          getRowId={(member) => member.id}
          isLoading={false}
          emptyIcon={<UsersRound className="w-10 h-10" />}
          emptyTitle="No hay jugadores registrados en este equipo"
          emptyDescription="Añadí jugadores para armar la lista de buena fe."
          toolbar={
            <h2 className="type-h3 text-primary-900 flex items-center gap-2">
              <UsersRound className="w-5 h-5 text-primary-500" aria-hidden="true" />
              Lista de Buena Fe
            </h2>
          }
        />
      </div>

      <AddMemberModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
      />

      <Dialog open={!!memberToRemove} onOpenChange={(open) => !open && setMemberToRemove(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar Jugador</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas eliminar a {memberToRemove?.participant?.firstName} del equipo? Esta acción puede requerir re-verificación de la lista de buena fe.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setMemberToRemove(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleRemove} disabled={removeMemberMutation.isPending}>
              {removeMemberMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Eliminar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
